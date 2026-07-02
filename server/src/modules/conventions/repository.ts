import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { ConventionDraft } from './extractor.js';
import type { ConventionRow } from '../../db/rows.js';

export type { ConventionRow };

export class ConventionsRepository {
  constructor(private db: Db) {}

  async listForRepo(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)));
  }

  async replaceAll(
    workspaceId: string,
    repoId: string,
    drafts: ConventionDraft[],
  ): Promise<ConventionRow[]> {
    return this.db.transaction(async (tx) => {
      await tx
        .delete(t.conventions)
        .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)));

      if (drafts.length === 0) return [];

      return tx
        .insert(t.conventions)
        .values(
          drafts.map((d) => ({
            workspaceId,
            repoId,
            rule: d.rule,
            evidencePath: d.evidence_path,
            evidenceSnippet: d.evidence_snippet,
            confidence: d.confidence,
            accepted: false,
          })),
        )
        .returning();
    });
  }
}
