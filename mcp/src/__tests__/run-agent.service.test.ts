import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RunAgentService } from '../services/run-agent.service.js';
import { Resolver } from '../resolver.js';
import type { DevDigestApiClient, ReviewDto } from '../ports.js';

function fakeClient(overrides: Partial<DevDigestApiClient>): DevDigestApiClient {
  return {
    listRepos: async () => [{ id: 'r1', owner: 'acme', name: 'widgets', full_name: 'acme/widgets' }],
    listPulls: async () => [{ id: 'pr-1', number: 7 }],
    getAgents: async () => [],
    startReview: async () => ({ pr_id: 'pr-1', runs: [{ run_id: 'run-1', agent_id: 'a1', agent_name: 'Reviewer' }] }),
    getReviews: async () => [],
    getConventions: async () => [],
    ...overrides,
  };
}

describe('RunAgentService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns completed once a review with the matching run_id appears within the poll budget', async () => {
    const review: ReviewDto = {
      id: 'rev-1',
      pr_id: 'pr-1',
      agent_id: 'a1',
      run_id: 'run-1',
      kind: 'review',
      verdict: 'approve',
      summary: 'Looks good',
      findings: [
        {
          id: 'f1',
          severity: 'warning',
          category: 'style',
          title: 'Nit',
          file: 'a.ts',
          start_line: 1,
          end_line: 1,
          suggestion: null,
          confidence: 0.8,
          kind: 'finding',
        },
      ],
    };
    let call = 0;
    const client = fakeClient({
      getReviews: async () => {
        call += 1;
        // First poll: no matching review yet (simulates other/stale reviews); second poll: found.
        return call === 1 ? [] : [review];
      },
    });
    const resolver = new Resolver(client);
    const service = new RunAgentService(client, resolver, 10_000);

    const promise = service.run({ repo: 'acme/widgets', pr_number: 7, agent_id: 'a1' });
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result.status).toBe('completed');
    if (result.status === 'completed') {
      expect(result.run_id).toBe('run-1');
      expect(result.verdict).toBe('approve');
      expect(result.findings).toHaveLength(1);
    }
  });

  it('returns running once the poll budget is exhausted with no matching review', async () => {
    const client = fakeClient({ getReviews: async () => [] });
    const resolver = new Resolver(client);
    const service = new RunAgentService(client, resolver, 3_000);

    const promise = service.run({ repo: 'acme/widgets', pr_number: 7, agent_id: 'a1' });
    await vi.advanceTimersByTimeAsync(3_000);
    const result = await promise;

    expect(result).toEqual({ status: 'running', run_id: 'run-1', poll_after_seconds: 30 });
  });

  it('ignores reviews from other run_ids when correlating', async () => {
    const otherReview: ReviewDto = {
      id: 'rev-other',
      pr_id: 'pr-1',
      agent_id: 'a2',
      run_id: 'run-other',
      kind: 'review',
      verdict: 'reject',
      summary: 'Different run',
      findings: [],
    };
    const client = fakeClient({ getReviews: async () => [otherReview] });
    const resolver = new Resolver(client);
    const service = new RunAgentService(client, resolver, 2_000);

    const promise = service.run({ repo: 'acme/widgets', pr_number: 7, agent_id: 'a1' });
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(result.status).toBe('running');
  });
});
