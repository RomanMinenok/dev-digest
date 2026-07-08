import type { DevDigestApiClient, RepoDto } from './ports.js';

export class ResolutionError extends Error {}

/** Repo+PR-number → uuid resolver. Caches `GET /repos` per resolver instance (one MCP tool call). */
export class Resolver {
  private reposCache: RepoDto[] | null = null;

  constructor(private readonly client: DevDigestApiClient) {}

  private async repos(): Promise<RepoDto[]> {
    if (!this.reposCache) {
      this.reposCache = await this.client.listRepos();
    }
    return this.reposCache;
  }

  async resolveRepoId(repo: string): Promise<string> {
    const repos = await this.repos();
    const byFullName = repos.find((r) => r.full_name === repo);
    if (byFullName) return byFullName.id;

    const byName = repos.filter((r) => r.name === repo);
    if (byName.length === 1) return byName[0].id;
    if (byName.length > 1) {
      const options = byName.map((r) => r.full_name).join(', ');
      throw new ResolutionError(
        `Repo name '${repo}' is ambiguous — matches multiple repos: ${options}. Use 'owner/name'.`,
      );
    }

    const known = repos.map((r) => r.full_name).join(', ') || '(none registered)';
    throw new ResolutionError(`Unknown repo '${repo}'. Known repos: ${known}`);
  }

  async resolvePrId(repo: string, prNumber: number): Promise<string> {
    const repoId = await this.resolveRepoId(repo);
    const pulls = await this.client.listPulls(repoId);
    const match = pulls.find((p) => p.number === prNumber);
    if (!match) {
      const known = pulls.map((p) => p.number).join(', ') || '(none)';
      throw new ResolutionError(`PR #${prNumber} not found in '${repo}'. Known PR numbers: ${known}`);
    }
    return match.id;
  }
}
