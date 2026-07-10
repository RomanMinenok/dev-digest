import type { ContextDoc, GitClient, RepoRef } from '@devdigest/shared';
import { walkMarkdownFiles } from './walk.js';
import { ProjectContextRepository } from './repository.js';
import { buildDiscoveryList, estimateTokens, unionAttachedPaths } from './helpers.js';

/**
 * Application layer for Project Context (T7, SPEC-01). Depends ONLY on the
 * `GitClient` port + this module's own `ProjectContextRepository` —
 * deliberately does NOT import or couple to `modules/intent/spec-resolver.ts`.
 * Project Context and the Intent Layer are two independent readers of the
 * same repo markdown for two different purposes (SPEC-01 Non-goals;
 * server/INSIGHTS.md); they must never share resolution or storage code.
 *
 * No LLM calls anywhere in this service, and nothing is cached: discovery,
 * used-by counting, and the token estimate are all pure fs-read + arithmetic,
 * recomputed fresh on every call (AC-10/AC-13/AC-4a "live, never-cached").
 */
export class ProjectContextService {
  constructor(
    private git: GitClient,
    private repo: ProjectContextRepository,
  ) {}

  /**
   * Discover every `.md` file in `ref`'s clone (T6's walk) and annotate each
   * with how many agents (agents only — AC-4) currently have it attached.
   * Uses `GitClient.clonePathFor` to resolve the clone root deterministically
   * — no DB repo-row lookup needed here.
   */
  async discover(workspaceId: string, ref: RepoRef): Promise<ContextDoc[]> {
    const clonePath = this.git.clonePathFor(ref);
    const [files, agentDocs] = await Promise.all([
      walkMarkdownFiles(clonePath),
      this.repo.listAgentContextDocs(workspaceId),
    ]);
    return buildDiscoveryList(files, agentDocs);
  }

  /**
   * Union of every path attached to at least one agent OR skill in the
   * workspace — the AC-4a scan-summary footer's scope (broader than
   * `discover()`'s agents-only `used_by_count`). Callers (routes.ts, T8)
   * combine this with `discover()`'s `size_bytes` to sum the footer's
   * attached-doc token total.
   */
  async attachedPaths(workspaceId: string): Promise<Set<string>> {
    const [agentDocs, skillDocs] = await Promise.all([
      this.repo.listAgentContextDocs(workspaceId),
      this.repo.listSkillContextDocs(workspaceId),
    ]);
    return unionAttachedPaths(agentDocs, skillDocs);
  }

  /**
   * Resolve a single doc's exact content for the Preview button (AC-9), via
   * the path-safe `GitClient.readFile` guard added in T5 — path safety is
   * NOT re-implemented here. Also returns the same deterministic, no-cache
   * token estimate as the discovery list.
   */
  async preview(
    ref: RepoRef,
    path: string,
  ): Promise<{ path: string; content: string; token_estimate: number }> {
    const content = await this.git.readFile(ref, path);
    return {
      path,
      content,
      token_estimate: estimateTokens(Buffer.byteLength(content, 'utf8')),
    };
  }
}
