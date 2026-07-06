import { describe, it, expect } from 'vitest';
import { assembleSmartDiff, type SmartDiffPrFile } from './service.js';
import type { ReviewDto, ReviewDtoFinding } from '../reviews/helpers.js';

function finding(overrides: Partial<ReviewDtoFinding> = {}): ReviewDtoFinding {
  return {
    id: 'f1',
    severity: 'WARNING',
    category: 'bug',
    title: 'title',
    file: 'src/modules/reviews/service.ts',
    start_line: 10,
    end_line: 12,
    rationale: 'rationale',
    suggestion: null,
    confidence: 0.9,
    review_id: 'r1',
    accepted_at: null,
    dismissed_at: null,
    ...overrides,
  };
}

function review(overrides: Partial<ReviewDto> = {}): ReviewDto {
  return {
    id: 'r1',
    pr_id: 'pr1',
    agent_id: null,
    run_id: null,
    kind: 'review',
    verdict: null,
    summary: null,
    score: null,
    model: null,
    created_at: new Date().toISOString(),
    findings: [],
    ...overrides,
  };
}

describe('assembleSmartDiff', () => {
  it('classifies files into role groups', () => {
    const files: SmartDiffPrFile[] = [
      { path: 'src/modules/reviews/service.ts', additions: 5, deletions: 0 },
      { path: 'src/index.ts', additions: 2, deletions: 0 },
      { path: 'pnpm-lock.yaml', additions: 100, deletions: 0 },
    ];
    const result = assembleSmartDiff(files, []);
    expect(result.groups).toEqual([
      { role: 'core', files: [{ path: 'src/modules/reviews/service.ts', additions: 5, deletions: 0, finding_lines: [] }] },
      { role: 'wiring', files: [{ path: 'src/index.ts', additions: 2, deletions: 0, finding_lines: [] }] },
      { role: 'boilerplate', files: [{ path: 'pnpm-lock.yaml', additions: 100, deletions: 0, finding_lines: [] }] },
    ]);
  });

  it('excludes reviews outside the 60s session window', () => {
    const now = Date.now();
    const files: SmartDiffPrFile[] = [{ path: 'src/a.ts', additions: 1, deletions: 0 }];
    const reviews = [
      review({
        id: 'latest',
        created_at: new Date(now).toISOString(),
        findings: [finding({ file: 'src/a.ts', start_line: 1 })],
      }),
      review({
        id: 'stale',
        created_at: new Date(now - 61_000).toISOString(),
        findings: [finding({ file: 'src/a.ts', start_line: 2 })],
      }),
    ];
    const result = assembleSmartDiff(files, reviews);
    const core = result.groups.find((g) => g.role === 'core')!;
    expect(core.files[0]!.finding_lines).toEqual([1]);
  });

  it('includes reviews within the 60s session window', () => {
    const now = Date.now();
    const files: SmartDiffPrFile[] = [{ path: 'src/a.ts', additions: 1, deletions: 0 }];
    const reviews = [
      review({
        id: 'latest',
        created_at: new Date(now).toISOString(),
        findings: [finding({ file: 'src/a.ts', start_line: 1 })],
      }),
      review({
        id: 'same-session',
        created_at: new Date(now - 30_000).toISOString(),
        findings: [finding({ file: 'src/a.ts', start_line: 2 })],
      }),
    ];
    const result = assembleSmartDiff(files, reviews);
    const core = result.groups.find((g) => g.role === 'core')!;
    expect(core.files[0]!.finding_lines.sort()).toEqual([1, 2]);
  });

  it('flags too_big above the 400-line threshold and proposes splits per non-empty role', () => {
    const files: SmartDiffPrFile[] = [
      { path: 'src/a.ts', additions: 300, deletions: 0 },
      { path: 'src/index.ts', additions: 150, deletions: 0 },
    ];
    const result = assembleSmartDiff(files, []);
    expect(result.split_suggestion.too_big).toBe(true);
    expect(result.split_suggestion.total_lines).toBe(450);
    expect(result.split_suggestion.proposed_splits).toEqual([
      { name: 'Core changes', files: ['src/a.ts'] },
      { name: 'Wiring changes', files: ['src/index.ts'] },
    ]);
  });

  it('does not flag too_big at or below the 400-line threshold', () => {
    const files: SmartDiffPrFile[] = [{ path: 'src/a.ts', additions: 400, deletions: 0 }];
    const result = assembleSmartDiff(files, []);
    expect(result.split_suggestion.too_big).toBe(false);
    expect(result.split_suggestion.proposed_splits).toEqual([]);
  });
});
