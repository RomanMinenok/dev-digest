import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import type { PullRow } from '../../db/rows.js';
import * as t from '../../db/schema.js';

export type { PullRow };

/** Pulls module data-access — the only layer touching the DB for PR/file lookups. */
export class PullsRepository {
  constructor(private db: Db) {}

  async findPr(workspaceId: string, prId: string): Promise<PullRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)));
    return row;
  }

  listPrFiles(prId: string): Promise<(typeof t.prFiles.$inferSelect)[]> {
    return this.db.select().from(t.prFiles).where(eq(t.prFiles.prId, prId));
  }
}
