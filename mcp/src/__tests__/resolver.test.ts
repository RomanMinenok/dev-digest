import { describe, it, expect } from 'vitest';
import { Resolver, ResolutionError } from '../resolver.js';
import type { DevDigestApiClient, PullDto, RepoDto } from '../ports.js';

function fakeClient(repos: RepoDto[], pulls: Record<string, PullDto[]> = {}): DevDigestApiClient {
  return {
    listRepos: async () => repos,
    listPulls: async (repoId) => pulls[repoId] ?? [],
    getAgents: async () => [],
    startReview: async () => ({ pr_id: '', runs: [] }),
    getReviews: async () => [],
    getConventions: async () => [],
    getBlast: async () => ({ changed_symbols: [], downstream: [], status: 'full', summary: '' }),
  };
}

describe('Resolver', () => {
  it('resolves repoId by full_name match', async () => {
    const repos: RepoDto[] = [{ id: 'r1', owner: 'acme', name: 'widgets', full_name: 'acme/widgets' }];
    const resolver = new Resolver(fakeClient(repos));
    await expect(resolver.resolveRepoId('acme/widgets')).resolves.toBe('r1');
  });

  it('resolves repoId by unique name match when full_name does not match', async () => {
    const repos: RepoDto[] = [{ id: 'r1', owner: 'acme', name: 'widgets', full_name: 'acme/widgets' }];
    const resolver = new Resolver(fakeClient(repos));
    await expect(resolver.resolveRepoId('widgets')).resolves.toBe('r1');
  });

  it('throws a clear error when repo name is ambiguous', async () => {
    const repos: RepoDto[] = [
      { id: 'r1', owner: 'acme', name: 'widgets', full_name: 'acme/widgets' },
      { id: 'r2', owner: 'other', name: 'widgets', full_name: 'other/widgets' },
    ];
    const resolver = new Resolver(fakeClient(repos));
    await expect(resolver.resolveRepoId('widgets')).rejects.toThrow(ResolutionError);
  });

  it('throws a clear error when repo is unknown', async () => {
    const resolver = new Resolver(fakeClient([]));
    await expect(resolver.resolveRepoId('nope/nope')).rejects.toThrow(ResolutionError);
  });

  it('resolves prId by matching pull number within the resolved repo', async () => {
    const repos: RepoDto[] = [{ id: 'r1', owner: 'acme', name: 'widgets', full_name: 'acme/widgets' }];
    const pulls: Record<string, PullDto[]> = { r1: [{ id: 'pr-uuid-1', number: 42 }] };
    const resolver = new Resolver(fakeClient(repos, pulls));
    await expect(resolver.resolvePrId('acme/widgets', 42)).resolves.toBe('pr-uuid-1');
  });

  it('throws a clear error when pr number is not found', async () => {
    const repos: RepoDto[] = [{ id: 'r1', owner: 'acme', name: 'widgets', full_name: 'acme/widgets' }];
    const pulls: Record<string, PullDto[]> = { r1: [{ id: 'pr-uuid-1', number: 42 }] };
    const resolver = new Resolver(fakeClient(repos, pulls));
    await expect(resolver.resolvePrId('acme/widgets', 99)).rejects.toThrow(ResolutionError);
  });
});
