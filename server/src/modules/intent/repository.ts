import { and, eq } from 'drizzle-orm';
import type { IntentSource } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export type PrIntentRow = typeof t.prIntent.$inferSelect;
export type PullRow = typeof t.pullRequests.$inferSelect;
export type RepoRow = typeof t.repos.$inferSelect;

export interface UpsertIntentInput {
  intent: string;
  inScope: string[];
  outOfScope: string[];
  model: string | null;
  headSha: string | null;
  sources: IntentSource[] | null;
}

export class IntentRepository {
  constructor(private db: Db) {}

  async get(prId: string): Promise<PrIntentRow | undefined> {
    const [row] = await this.db.select().from(t.prIntent).where(eq(t.prIntent.prId, prId));
    return row;
  }

  /** Workspace-scoped PR + its repo — the pair `service.ts` needs to compute intent. */
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
   * Insert-or-replace the single `pr_intent` row for `prId`. The conflict set
   * lists EVERY updatable column (not just a subset) — server/INSIGHTS.md
   * documents a past bug where an incomplete `onConflictDoUpdate` set left
   * columns silently stale after a recompute.
   */
  async upsert(prId: string, input: UpsertIntentInput): Promise<PrIntentRow> {
    const values = {
      prId,
      intent: input.intent,
      inScope: input.inScope,
      outOfScope: input.outOfScope,
      model: input.model,
      headSha: input.headSha,
      sources: input.sources,
      updatedAt: new Date(),
    };

    const [row] = await this.db
      .insert(t.prIntent)
      .values(values)
      .onConflictDoUpdate({
        target: t.prIntent.prId,
        set: {
          intent: values.intent,
          inScope: values.inScope,
          outOfScope: values.outOfScope,
          model: values.model,
          headSha: values.headSha,
          sources: values.sources,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    return row!;
  }
}
