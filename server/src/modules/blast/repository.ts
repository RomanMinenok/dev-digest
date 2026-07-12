import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export type PullRow = typeof t.pullRequests.$inferSelect;
export type RepoRow = typeof t.repos.$inferSelect;

/** Workspace-scoped PR+repo read + changed-file paths — no LLM, no facade calls. */
export class BlastRepository {
  constructor(private db: Db) {}

  /** Workspace-scoped PR + its repo — mirrors `IntentRepository.getPullAndRepo`. */
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

  /** Changed-file paths for the PR — mirrors `PullsRepository.listPrFiles`, projected to paths only. */
  async listChangedFiles(prId: string): Promise<string[]> {
    const rows = await this.db
      .select({ path: t.prFiles.path })
      .from(t.prFiles)
      .where(eq(t.prFiles.prId, prId));
    return rows.map((r) => r.path);
  }
}
