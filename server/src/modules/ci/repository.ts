import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { CiTarget, RunTrace } from '@devdigest/shared';

// ── Row / input shapes ───────────────────────────────────────────────────────

export type CiInstallationRow = typeof t.ciInstallations.$inferSelect;
export type CiRunRow = typeof t.ciRuns.$inferSelect;

export interface CreateInstallationInput {
  agentId: string;
  repo: string;
  targetType: CiTarget;
}

export interface ListCiRunsFilters {
  days?: number;
  agentId?: string;
  repo?: string;
  status?: string;
  source?: string;
}

/** Joined row for the CI Runs list — service maps to the snake_case `CiRun` DTO. */
export interface CiRunListRow {
  ciRun: CiRunRow;
  agentId: string | null;
  agentName: string | null;
  repo: string | null;
  durationMs: number | null;
  runCostUsd: number | null;
}

/**
 * Fully mapped ingest payload from the application layer (`mapCiIngestInput`).
 * Repository / persister only insert — no field fallbacks here.
 */
export interface MappedCiIngestInput {
  ciInstallationId: string;
  agentId: string;
  workspaceId: string;
  githubUrl: string;
  ranAt: Date;
  prNumber: number | null;
  status: string;
  source: string;
  /** When null, AC-31: status-only `ci_runs` row with null `run_id`. */
  agentRun: {
    provider: string | null;
    model: string | null;
    durationMs: number | null;
    tokensIn: number | null;
    tokensOut: number | null;
    findingsCount: number;
    grounding: string | null;
    costUsd: number | null;
    prTitle: string | null;
    critical: number | null;
    warning: number | null;
    suggestion: number | null;
    trace: RunTrace | null;
  } | null;
}

/** Composition-root-injected writer — no Drizzle types on this surface. */
export type PersistCiIngestRun = (input: MappedCiIngestInput) => Promise<CiRunRow>;

export interface LatestRunPerInstallationRow {
  ciInstallationId: string;
  ciRun: CiRunRow;
}

// ── Repository ────────────────────────────────────────────────────────────────

export class CiRepository {
  constructor(
    private db: Db,
    private persistIngest: PersistCiIngestRun,
  ) {}

  // ── Installations (AC-25, AC-32, Decision 6) ─────────────────────────────

  async createInstallation(input: CreateInstallationInput): Promise<CiInstallationRow> {
    const [row] = await this.db
      .insert(t.ciInstallations)
      .values({
        agentId: input.agentId,
        repo: input.repo,
        targetType: input.targetType,
      })
      .returning();
    return row!;
  }

  /**
   * Persist or refresh an installation for agent + repo (re-export / update
   * paths bump `installed_at`).
   */
  async upsertInstallation(input: CreateInstallationInput): Promise<CiInstallationRow> {
    const [existing] = await this.db
      .select()
      .from(t.ciInstallations)
      .where(
        and(
          eq(t.ciInstallations.agentId, input.agentId),
          eq(t.ciInstallations.repo, input.repo),
        ),
      );

    if (existing) {
      const [row] = await this.db
        .update(t.ciInstallations)
        .set({
          targetType: input.targetType,
          installedAt: new Date(),
        })
        .where(eq(t.ciInstallations.id, existing.id))
        .returning();
      return row!;
    }

    return this.createInstallation(input);
  }

  /**
   * Installations scoped to a workspace via `agents.workspace_id`, with an
   * optional active-repo filter (Decision 6).
   */
  async listInstallations(
    workspaceId: string,
    opts?: { repo?: string; agentId?: string },
  ): Promise<CiInstallationRow[]> {
    const conditions = [eq(t.agents.workspaceId, workspaceId)];
    if (opts?.repo) conditions.push(eq(t.ciInstallations.repo, opts.repo));
    if (opts?.agentId) conditions.push(eq(t.ciInstallations.agentId, opts.agentId));

    return this.db
      .select({ installation: t.ciInstallations })
      .from(t.ciInstallations)
      .innerJoin(t.agents, eq(t.agents.id, t.ciInstallations.agentId))
      .where(and(...conditions))
      .then((rows) => rows.map((r) => r.installation));
  }

  // ── CI runs list (AC-36, AC-38) ────────────────────────────────────────────

  /**
   * CI-metadata rows only — never local `agent_runs` without a matching
   * `ci_runs` row (AC-36). Duration and canonical cost come from the linked
   * `agent_runs` row when `run_id` is set (AC-37).
   */
  async listCiRuns(workspaceId: string, filters: ListCiRunsFilters = {}): Promise<CiRunListRow[]> {
    const days = filters.days ?? 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const conditions = [
      eq(t.agents.workspaceId, workspaceId),
      gte(t.ciRuns.ranAt, cutoff),
    ];
    if (filters.agentId) conditions.push(eq(t.ciInstallations.agentId, filters.agentId));
    if (filters.repo) conditions.push(eq(t.ciInstallations.repo, filters.repo));
    if (filters.status) conditions.push(eq(t.ciRuns.status, filters.status));
    if (filters.source) conditions.push(eq(t.ciRuns.source, filters.source));

    const rows = await this.db
      .select({
        ciRun: t.ciRuns,
        agentId: t.ciInstallations.agentId,
        agentName: t.agents.name,
        repo: t.ciInstallations.repo,
        durationMs: t.agentRuns.durationMs,
        runCostUsd: t.agentRuns.costUsd,
      })
      .from(t.ciRuns)
      .innerJoin(t.ciInstallations, eq(t.ciInstallations.id, t.ciRuns.ciInstallationId))
      .innerJoin(t.agents, eq(t.agents.id, t.ciInstallations.agentId))
      .leftJoin(t.agentRuns, eq(t.agentRuns.id, t.ciRuns.runId))
      .where(and(...conditions))
      .orderBy(desc(t.ciRuns.ranAt));

    return rows.map((r) => ({
      ciRun: r.ciRun,
      agentId: r.agentId,
      agentName: r.agentName,
      repo: r.repo,
      durationMs: r.durationMs,
      runCostUsd: r.runCostUsd,
    }));
  }

  // ── Ingest dedup (AC-33) ───────────────────────────────────────────────────

  /** `(ci_installation_id, github_url)` keys already persisted for dedup. */
  async existingRunKeys(installationId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ githubUrl: t.ciRuns.githubUrl })
      .from(t.ciRuns)
      .where(eq(t.ciRuns.ciInstallationId, installationId));

    return new Set(
      rows.map((r) => r.githubUrl).filter((url): url is string => url != null),
    );
  }

  // ── Derived installation status (AC-41) ────────────────────────────────────

  /** Most recent `ci_runs` row per installation (newest `ran_at` wins). */
  async latestRunPerInstallation(
    installationIds?: string[],
  ): Promise<LatestRunPerInstallationRow[]> {
    const base = this.db.select().from(t.ciRuns).orderBy(desc(t.ciRuns.ranAt));
    const rows =
      installationIds && installationIds.length > 0
        ? await base.where(inArray(t.ciRuns.ciInstallationId, installationIds))
        : await base;

    const seen = new Set<string>();
    const latest: LatestRunPerInstallationRow[] = [];
    for (const ciRun of rows) {
      const installationId = ciRun.ciInstallationId;
      if (!installationId || seen.has(installationId)) continue;
      seen.add(installationId);
      latest.push({ ciInstallationId: installationId, ciRun });
    }
    return latest;
  }

  // ── Ingest (AC-29, AC-30, AC-31) ───────────────────────────────────────────

  /**
   * Persist one pre-mapped ingest payload. Write path is injected from the
   * composition root so `agent_runs` / `run_traces` / `ci_runs` share one
   * transaction without exposing Drizzle on the port type.
   */
  async ingestRun(input: MappedCiIngestInput): Promise<CiRunRow> {
    return this.persistIngest(input);
  }
}
