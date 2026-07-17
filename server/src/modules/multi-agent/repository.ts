import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { FindingRow } from '../../db/rows.js';

/**
 * Infrastructure layer for SPEC-05 multi-agent review (T-10).
 *
 * The ONLY place Drizzle appears in `modules/multi-agent/*` — mirrors the
 * `ReviewRepository` shape (`constructor(private db: Db)`, methods return
 * rows). No grouping, no status derivation, no median here: those are the
 * pure functions in `grouping.ts` / `status.ts` / `estimate.ts` (T-04..T-07).
 * No writes to any "groups" table — groups are computed on read and never
 * persisted (AC-31); `multi_agent_runs` keeps its current stub shape
 * (`id`, `workspace_id`, `pr_id`, `ran_at`) with no `status` column — status
 * is derived on read, never stored.
 *
 * Every `.where` below is workspace-scoped (AC-16) — see the tenancy note in
 * `server/INSIGHTS.md`: `noUnusedLocals` is off, so a dropped
 * `eq(t.<table>.workspaceId, workspaceId)` clause typechecks cleanly. Grep
 * this file for `workspaceId` before trusting it.
 */

export type MultiAgentRunRow = typeof t.multiAgentRuns.$inferSelect;
export type ReviewRow = typeof t.reviews.$inferSelect;

/** One member (agent_run) of a multi-agent run, with its review + findings. */
export interface MemberRunRow {
  runId: string;
  agentId: string | null;
  agentName: string | null;
  status: string | null;
  durationMs: number | null;
  costUsd: number | null;
  error: string | null;
  review: ReviewRow | undefined;
  findings: FindingRow[];
}

export interface MultiAgentRunWithMembers {
  run: MultiAgentRunRow;
  members: MemberRunRow[];
}

/** Last-5-`done`-runs rows per agent, used by the pure estimate (T-07). */
export interface EstimateSourceRow {
  durationMs: number | null;
  costUsd: number | null;
}

export class MultiAgentRepository {
  constructor(private db: Db) {}

  /** Create one `multi_agent_runs` row for this PR; returns its id. */
  async create(workspaceId: string, prId: string): Promise<string> {
    const [row] = await this.db
      .insert(t.multiAgentRuns)
      .values({ workspaceId, prId })
      .returning({ id: t.multiAgentRuns.id });
    return row!.id;
  }

  /**
   * The newest `multi_agent_runs` row for this PR, plus its member
   * `agent_runs` (left-joined to `agents` for the name — the agent may be
   * deleted), each member's `reviews` row and its `findings`.
   *
   * The join chain is `findings.review_id → reviews.id → reviews.run_id`;
   * `agent_runs` has NO direct FK to `findings` (see `server/INSIGHTS.md`).
   */
  async latestForPull(
    workspaceId: string,
    prId: string,
  ): Promise<MultiAgentRunWithMembers | undefined> {
    const [run] = await this.db
      .select()
      .from(t.multiAgentRuns)
      .where(and(eq(t.multiAgentRuns.workspaceId, workspaceId), eq(t.multiAgentRuns.prId, prId)))
      .orderBy(desc(t.multiAgentRuns.ranAt))
      .limit(1);
    if (!run) return undefined;

    const memberRows = await this.db
      .select({
        id: t.agentRuns.id,
        agentId: t.agentRuns.agentId,
        agentName: t.agents.name,
        status: t.agentRuns.status,
        durationMs: t.agentRuns.durationMs,
        costUsd: t.agentRuns.costUsd,
        error: t.agentRuns.error,
      })
      .from(t.agentRuns)
      .leftJoin(t.agents, eq(t.agents.id, t.agentRuns.agentId))
      .where(
        and(eq(t.agentRuns.workspaceId, workspaceId), eq(t.agentRuns.multiAgentRunId, run.id)),
      );

    const runIds = memberRows.map((r) => r.id);
    const reviewRows =
      runIds.length > 0
        ? await this.db
            .select()
            .from(t.reviews)
            .where(and(eq(t.reviews.workspaceId, workspaceId), inArray(t.reviews.runId, runIds)))
        : [];

    const reviewIds = reviewRows.map((r) => r.id);
    const findingRows =
      reviewIds.length > 0
        ? await this.db.select().from(t.findings).where(inArray(t.findings.reviewId, reviewIds))
        : [];

    const reviewByRunId = new Map<string, ReviewRow>();
    for (const review of reviewRows) {
      if (review.runId) reviewByRunId.set(review.runId, review);
    }
    const findingsByReviewId = new Map<string, FindingRow[]>();
    for (const finding of findingRows) {
      const list = findingsByReviewId.get(finding.reviewId) ?? [];
      list.push(finding);
      findingsByReviewId.set(finding.reviewId, list);
    }

    const members: MemberRunRow[] = memberRows.map((m) => {
      const review = reviewByRunId.get(m.id);
      return {
        runId: m.id,
        agentId: m.agentId,
        agentName: m.agentName ?? null,
        status: m.status,
        durationMs: m.durationMs,
        costUsd: m.costUsd,
        error: m.error,
        review,
        findings: review ? findingsByReviewId.get(review.id) ?? [] : [],
      };
    });

    return { run, members };
  }

  /**
   * Per agent, the last 5 `agent_runs` rows with `status = 'done'`, ordered
   * `ran_at DESC`, returning just `duration_ms`/`cost_usd` — the pure inputs
   * `estimateForAgent` (T-07) needs. One workspace-scoped query per agent.
   */
  async doneRunsForEstimate(
    workspaceId: string,
    agentIds: string[],
  ): Promise<Map<string, EstimateSourceRow[]>> {
    const result = new Map<string, EstimateSourceRow[]>();
    for (const agentId of agentIds) {
      const rows = await this.db
        .select({ durationMs: t.agentRuns.durationMs, costUsd: t.agentRuns.costUsd })
        .from(t.agentRuns)
        .where(
          and(
            eq(t.agentRuns.workspaceId, workspaceId),
            eq(t.agentRuns.agentId, agentId),
            eq(t.agentRuns.status, 'done'),
          ),
        )
        .orderBy(desc(t.agentRuns.ranAt))
        .limit(5);
      result.set(agentId, rows);
    }
    return result;
  }
}
