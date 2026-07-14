import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { EvalCaseRow, EvalRunRow } from './types.js';

export type { EvalCaseRow, EvalRunRow };

// ── Input shapes ─────────────────────────────────────────────────────────────

export interface CreateCaseInput {
  workspaceId: string;
  ownerKind: 'skill' | 'agent';
  ownerId: string;
  name: string;
  inputDiff?: string | null;
  inputFiles?: unknown;
  inputMeta?: unknown;
  expectedOutput?: unknown;
  notes?: string | null;
}

export interface UpdateCaseInput {
  name?: string;
  inputDiff?: string | null;
  inputFiles?: unknown;
  inputMeta?: unknown;
  expectedOutput?: unknown;
  notes?: string | null;
}

export interface InsertRunInput {
  agentVersion: number | null;
  pass: boolean | null;
  recall: number | null;
  precision: number | null;
  citationAccuracy: number | null;
  durationMs: number | null;
  costUsd: number | null;
  actualOutput: unknown;
  /**
   * Raw scoring counts. Optional because a FAILED run (the model call threw)
   * has no score to record — see `EvalService.runCases`. A successful run
   * always supplies all six; the dashboard pools them (AC-23/25/27).
   */
  matched?: number | null;
  expectedTotal?: number | null;
  produced?: number | null;
  falsePositives?: number | null;
  kept?: number | null;
  dropped?: number | null;
}

// ── Repository ────────────────────────────────────────────────────────────────

export class EvalRepository {
  constructor(private db: Db) {}

  // ── Cases ──────────────────────────────────────────────────────────────────

  /** All eval cases for a given owner (skill or agent) within a workspace. */
  async listCasesForOwner(
    workspaceId: string,
    ownerKind: 'skill' | 'agent',
    ownerId: string,
  ): Promise<EvalCaseRow[]> {
    return this.db
      .select()
      .from(t.evalCases)
      .where(
        and(
          eq(t.evalCases.workspaceId, workspaceId),
          eq(t.evalCases.ownerKind, ownerKind),
          eq(t.evalCases.ownerId, ownerId),
        ),
      );
  }

  /** Workspace-scoped single case lookup. Returns null if not found. */
  async getCase(workspaceId: string, id: string): Promise<EvalCaseRow | null> {
    const [row] = await this.db
      .select()
      .from(t.evalCases)
      .where(and(eq(t.evalCases.workspaceId, workspaceId), eq(t.evalCases.id, id)));
    return row ?? null;
  }

  /** Insert a new eval case; returns the created row. */
  async createCase(input: CreateCaseInput): Promise<EvalCaseRow> {
    const [row] = await this.db
      .insert(t.evalCases)
      .values({
        workspaceId: input.workspaceId,
        ownerKind: input.ownerKind,
        ownerId: input.ownerId,
        name: input.name,
        inputDiff: input.inputDiff ?? null,
        inputFiles: input.inputFiles ?? null,
        inputMeta: input.inputMeta ?? null,
        expectedOutput: input.expectedOutput ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    return row!;
  }

  /** Patch mutable fields of an existing case. Returns null if not found. */
  async updateCase(
    workspaceId: string,
    id: string,
    input: UpdateCaseInput,
  ): Promise<EvalCaseRow | null> {
    const updates: Partial<typeof t.evalCases.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name;
    if ('inputDiff' in input) updates.inputDiff = input.inputDiff ?? null;
    if ('inputFiles' in input) updates.inputFiles = input.inputFiles ?? null;
    if ('inputMeta' in input) updates.inputMeta = input.inputMeta ?? null;
    if ('expectedOutput' in input) updates.expectedOutput = input.expectedOutput ?? null;
    if ('notes' in input) updates.notes = input.notes ?? null;

    if (Object.keys(updates).length === 0) {
      return this.getCase(workspaceId, id);
    }

    const [row] = await this.db
      .update(t.evalCases)
      .set(updates)
      .where(and(eq(t.evalCases.workspaceId, workspaceId), eq(t.evalCases.id, id)))
      .returning();
    return row ?? null;
  }

  /**
   * Delete a case and all its runs.
   * `eval_runs.case_id` carries `onDelete: 'cascade'` (AC-36), so the DB
   * engine deletes the run rows automatically.
   */
  async deleteCase(workspaceId: string, id: string): Promise<void> {
    await this.db
      .delete(t.evalCases)
      .where(and(eq(t.evalCases.workspaceId, workspaceId), eq(t.evalCases.id, id)));
  }

  // ── Runs ───────────────────────────────────────────────────────────────────

  /** Append a new eval run for a case; returns the created row. */
  async insertRun(caseId: string, input: InsertRunInput): Promise<EvalRunRow> {
    const [row] = await this.db
      .insert(t.evalRuns)
      .values({
        caseId,
        agentVersion: input.agentVersion ?? null,
        pass: input.pass ?? null,
        recall: input.recall ?? null,
        precision: input.precision ?? null,
        citationAccuracy: input.citationAccuracy ?? null,
        durationMs: input.durationMs ?? null,
        costUsd: input.costUsd ?? null,
        actualOutput: input.actualOutput ?? null,
        matched: input.matched ?? null,
        expectedTotal: input.expectedTotal ?? null,
        produced: input.produced ?? null,
        falsePositives: input.falsePositives ?? null,
        kept: input.kept ?? null,
        dropped: input.dropped ?? null,
      })
      .returning();
    return row!;
  }

  /**
   * For each case id, return the single most-recent run (by `ran_at`), or
   * nothing for cases that have no runs yet.
   */
  async latestRunPerCase(caseIds: string[]): Promise<EvalRunRow[]> {
    if (caseIds.length === 0) return [];

    const rows = await this.db
      .select()
      .from(t.evalRuns)
      .where(inArray(t.evalRuns.caseId, caseIds))
      .orderBy(desc(t.evalRuns.ranAt));

    // Keep only the first (latest) row per case — the ORDER BY desc(ranAt)
    // guarantees that the first occurrence per caseId is the newest.
    const seen = new Set<string>();
    return rows.filter((r) => {
      if (seen.has(r.caseId)) return false;
      seen.add(r.caseId);
      return true;
    });
  }

  /**
   * All runs for the given cases that match a specific `agentVersion`.
   * Ordered newest-first within each case.
   */
  async runsForAgentVersion(caseIds: string[], agentVersion: number): Promise<EvalRunRow[]> {
    if (caseIds.length === 0) return [];

    return this.db
      .select()
      .from(t.evalRuns)
      .where(
        and(
          inArray(t.evalRuns.caseId, caseIds),
          eq(t.evalRuns.agentVersion, agentVersion),
        ),
      )
      .orderBy(desc(t.evalRuns.ranAt));
  }

  /**
   * Sorted list of distinct `agentVersion` values that have at least one run
   * recorded across the given cases. Excludes nulls.
   */
  async distinctAgentVersionsWithRuns(caseIds: string[]): Promise<number[]> {
    if (caseIds.length === 0) return [];

    const rows = await this.db
      .selectDistinct({ agentVersion: t.evalRuns.agentVersion })
      .from(t.evalRuns)
      .where(inArray(t.evalRuns.caseId, caseIds))
      .orderBy(t.evalRuns.agentVersion);

    return rows
      .map((r) => r.agentVersion)
      .filter((v): v is number => v != null);
  }
}
