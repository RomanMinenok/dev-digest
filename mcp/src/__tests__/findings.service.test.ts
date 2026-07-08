import { describe, it, expect } from 'vitest';
import { FindingsService } from '../services/findings.service.js';
import { Resolver } from '../resolver.js';
import type { DevDigestApiClient, ReviewDto, ReviewFindingDto } from '../ports.js';

function finding(id: string, severity: string): ReviewFindingDto {
  return {
    id,
    severity,
    category: 'correctness',
    title: `Finding ${id}`,
    file: 'a.ts',
    start_line: 10,
    end_line: 12,
    suggestion: 'Fix it',
    confidence: 0.9,
    kind: 'finding',
  };
}

function fakeClient(reviews: ReviewDto[]): DevDigestApiClient {
  return {
    listRepos: async () => [{ id: 'r1', owner: 'acme', name: 'widgets', full_name: 'acme/widgets' }],
    listPulls: async () => [{ id: 'pr-1', number: 7 }],
    getAgents: async () => [],
    startReview: async () => ({ pr_id: 'pr-1', runs: [] }),
    getReviews: async () => reviews,
    getConventions: async () => [],
  };
}

const baseInput = { repo: 'acme/widgets', pr_number: 7, page: 1, page_size: 10 } as const;

describe('FindingsService', () => {
  it('returns "0 findings" (empty page) when there are no reviews yet', async () => {
    const client = fakeClient([]);
    const service = new FindingsService(client, new Resolver(client));
    const page = await service.get({ ...baseInput, response_format: 'concise' });
    expect(page.total).toBe(0);
    expect(page.findings).toEqual([]);
    expect(page.verdict).toBeNull();
  });

  it('aggregates findings from all "review" kind reviews and tolerates a null verdict', async () => {
    const reviews: ReviewDto[] = [
      {
        id: 'rev-1',
        pr_id: 'pr-1',
        agent_id: 'a1',
        run_id: 'run-1',
        kind: 'review',
        verdict: null,
        summary: 'in progress',
        findings: [finding('f1', 'critical'), finding('f2', 'warning')],
      },
      {
        id: 'rev-summary',
        pr_id: 'pr-1',
        agent_id: 'a1',
        run_id: 'run-1',
        kind: 'summary',
        verdict: 'approve',
        summary: 'summary row',
        findings: [finding('should-be-ignored', 'critical')],
      },
    ];
    const client = fakeClient(reviews);
    const service = new FindingsService(client, new Resolver(client));
    const page = await service.get({ ...baseInput, response_format: 'concise' });
    expect(page.total).toBe(2);
    expect(page.counts_by_severity).toEqual({ critical: 1, warning: 1 });
    expect(page.verdict).toBeNull();
  });

  it('concise output omits line range/suggestion; detailed includes them', async () => {
    const reviews: ReviewDto[] = [
      {
        id: 'rev-1',
        pr_id: 'pr-1',
        agent_id: 'a1',
        run_id: 'run-1',
        kind: 'review',
        verdict: 'approve',
        summary: 'ok',
        findings: [finding('f1', 'warning')],
      },
    ];
    const client = fakeClient(reviews);
    const service = new FindingsService(client, new Resolver(client));

    const concise = await service.get({ ...baseInput, response_format: 'concise' });
    expect(concise.findings[0].start_line).toBeNull();
    expect(concise.findings[0].suggestion).toBeNull();

    const detailed = await service.get({ ...baseInput, response_format: 'detailed' });
    expect(detailed.findings[0].start_line).toBe(10);
    expect(detailed.findings[0].suggestion).toBe('Fix it');
  });

  it('paginates findings by page/page_size', async () => {
    const many = Array.from({ length: 15 }, (_, i) => finding(`f${i}`, 'suggestion'));
    const reviews: ReviewDto[] = [
      { id: 'rev-1', pr_id: 'pr-1', agent_id: 'a1', run_id: 'run-1', kind: 'review', verdict: 'approve', summary: 'ok', findings: many },
    ];
    const client = fakeClient(reviews);
    const service = new FindingsService(client, new Resolver(client));

    const page1 = await service.get({ ...baseInput, response_format: 'concise', page: 1, page_size: 10 });
    const page2 = await service.get({ ...baseInput, response_format: 'concise', page: 2, page_size: 10 });
    expect(page1.total).toBe(15);
    expect(page1.findings).toHaveLength(10);
    expect(page2.findings).toHaveLength(5);
  });
});
