import { and, desc, eq, inArray } from 'drizzle-orm';
import type { PrBrief } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import { selectSessionWindow } from '../_shared/session-window.js';

export type PrBriefRow = typeof t.prBrief.$inferSelect;
export type PullRow = typeof t.pullRequests.$inferSelect;
export type RepoRow = typeof t.repos.$inferSelect;
export type ReviewRow = typeof t.reviews.$inferSelect;
export type FindingRow = typeof t.findings.$inferSelect;
export type AgentRow = typeof t.agents.$inferSelect;
export type SkillRow = typeof t.skills.$inferSelect;

export interface UpsertBriefInput {
  json: PrBrief;
  model: string | null;
  headSha: string | null;
}

/** One agent that ran in a session, with its enabled linked skills — the
 *  shape `sessionAgents` returns so the caller can run
 *  `resolveAttachedDocPaths(agent.contextDocs, linkedSkills)` per agent. */
export interface SessionAgent {
  agent: AgentRow;
  skills: SkillRow[];
}

const COMPLETED_STATUS = 'done';

export class BriefRepository {
  constructor(private db: Db) {}

  /** Fetch the current `pr_brief` row for a PR, or null if none exists. */
  async get(prId: string): Promise<PrBriefRow | null> {
    const [row] = await this.db.select().from(t.prBrief).where(eq(t.prBrief.prId, prId));
    return row ?? null;
  }

  /**
   * Insert-or-replace the single `pr_brief` row for `prId`. The conflict set
   * lists EVERY updatable column (json, model, headSha, updatedAt) — an
   * incomplete `onConflictDoUpdate` set silently leaves the unlisted columns
   * stale after a recompute (documented for `pr_intent` in
   * server/INSIGHTS.md's "What Doesn't Work"; the same rule applies here).
   */
  async upsert(prId: string, data: UpsertBriefInput): Promise<void> {
    const values = {
      prId,
      json: data.json,
      model: data.model,
      headSha: data.headSha,
      updatedAt: new Date(),
    };

    await this.db
      .insert(t.prBrief)
      .values(values)
      .onConflictDoUpdate({
        target: t.prBrief.prId,
        set: {
          json: values.json,
          model: values.model,
          headSha: values.headSha,
          updatedAt: values.updatedAt,
        },
      });
  }

  /** Workspace-scoped PR + its repo — mirrors IntentRepository.getPullAndRepo. */
  async getPullAndRepo(
    workspaceId: string,
    prId: string,
  ): Promise<{ pull: PullRow; repo: RepoRow } | undefined> {
    const [pull] = await this.db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)));
    if (!pull) return undefined;

    const [repo] = await this.db.select().from(t.repos).where(eq(t.repos.id, pull.repoId));
    if (!repo) return undefined;

    return { pull, repo };
  }

  /**
   * agent_runs within the shared session window (`_shared/session-window.ts`)
   * of the newest completed run for this PR — the "one review session".
   * Empty if no completed run exists. The windowing RULE itself lives in the
   * pure, framework-free `selectSessionWindow` helper (shared with
   * `pulls/service.ts`/`pulls/routes.ts`), not hand-rolled here — this method
   * is just the fetch-all-completed-runs-then-filter composition.
   */
  private async sessionRuns(prId: string): Promise<(typeof t.agentRuns.$inferSelect)[]> {
    const completedRuns = await this.db
      .select()
      .from(t.agentRuns)
      .where(and(eq(t.agentRuns.prId, prId), eq(t.agentRuns.status, COMPLETED_STATUS)))
      .orderBy(desc(t.agentRuns.ranAt));

    return selectSessionWindow(completedRuns, (r) => r.ranAt.getTime());
  }

  /**
   * Reviews (+ findings) belonging to the PR's latest review session.
   * `agent_runs` has no direct FK to `findings` — the join chain is always
   * agent_runs → reviews.run_id → findings.review_id. Returns [] if there is
   * no completed run for this PR at all.
   */
  async latestSessionReviews(prId: string): Promise<{ review: ReviewRow; findings: FindingRow[] }[]> {
    const runs = await this.sessionRuns(prId);
    if (runs.length === 0) return [];

    const runIds = runs.map((r) => r.id);
    const reviews = await this.db.select().from(t.reviews).where(inArray(t.reviews.runId, runIds));
    if (reviews.length === 0) return [];

    const reviewIds = reviews.map((r) => r.id);
    const findingsRows = await this.db
      .select()
      .from(t.findings)
      .where(inArray(t.findings.reviewId, reviewIds));

    return reviews.map((review) => ({
      review,
      findings: findingsRows.filter((f) => f.reviewId === review.id),
    }));
  }

  /**
   * Distinct agents that ran in the PR's latest session, each with its
   * enabled linked skills (agent_skills → skills, filtered to
   * `skills.enabled`) so the caller can pass `agent.contextDocs` plus those
   * skills' context docs into `resolveAttachedDocPaths` per agent.
   */
  async sessionAgents(prId: string): Promise<SessionAgent[]> {
    const runs = await this.sessionRuns(prId);
    if (runs.length === 0) return [];

    const agentIds = [...new Set(runs.map((r) => r.agentId).filter((id): id is string => id != null))];
    if (agentIds.length === 0) return [];

    const agents = await this.db.select().from(t.agents).where(inArray(t.agents.id, agentIds));
    if (agents.length === 0) return [];

    const links = await this.db
      .select({ agentId: t.agentSkills.agentId, skill: t.skills })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(and(inArray(t.agentSkills.agentId, agentIds), eq(t.skills.enabled, true)));

    return agents.map((agent) => ({
      agent,
      skills: links.filter((l) => l.agentId === agent.id).map((l) => l.skill),
    }));
  }
}
