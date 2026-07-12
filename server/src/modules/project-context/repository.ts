import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

/**
 * project-context data-access (T7). Read-only: returns every agent's and
 * every skill's `context_docs` array for a workspace. Consumed by
 * `service.ts` for AC-4 used-by counting (agents only) and the AC-4a
 * scan-summary footer (agents OR skills). Attaching/detaching a doc is owned
 * by the agents/skills modules' own repositories (T9/T10) — this module only
 * ever READS those two jsonb columns, never writes them.
 */
export class ProjectContextRepository {
  constructor(private db: Db) {}

  /** `context_docs` for every agent in the workspace (agents only — AC-4). */
  async listAgentContextDocs(workspaceId: string): Promise<string[][]> {
    const rows = await this.db
      .select({ contextDocs: t.agents.contextDocs })
      .from(t.agents)
      .where(eq(t.agents.workspaceId, workspaceId));
    return rows.map((r) => r.contextDocs ?? []);
  }

  /** `context_docs` for every skill in the workspace (used for the AC-4a
   *  footer's agents-OR-skills union — not part of AC-4's agents-only count). */
  async listSkillContextDocs(workspaceId: string): Promise<string[][]> {
    const rows = await this.db
      .select({ contextDocs: t.skills.contextDocs })
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId));
    return rows.map((r) => r.contextDocs ?? []);
  }
}
