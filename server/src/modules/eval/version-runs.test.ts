import { describe, it, expect } from 'vitest';
import {
  groupVersionRuns,
  filterByDays,
  buildTrend,
  measuredVersions,
  metricDelta,
} from './version-runs.js';
import { aggregateRunRows } from './scorer.js';
import type { EvalRunRow } from './types.js';

/**
 * Unit coverage for the pure version-run module (T25 / SPEC-04).
 * No DB, no HTTP — plain rows in, plain data out.
 */

/** Build a complete `eval_runs` row; every field the grouping reads is settable. */
function makeRow(p: Partial<EvalRunRow> & { caseId: string; ranAt: Date }): EvalRunRow {
  return {
    id: p.id ?? `run-${Math.random().toString(36).slice(2)}`,
    caseId: p.caseId,
    ranAt: p.ranAt,
    actualOutput: p.actualOutput ?? null,
    pass: p.pass ?? null,
    recall: p.recall ?? null,
    precision: p.precision ?? null,
    citationAccuracy: p.citationAccuracy ?? null,
    durationMs: p.durationMs ?? null,
    costUsd: p.costUsd ?? null,
    agentVersion: p.agentVersion ?? null,
    matched: p.matched ?? null,
    expectedTotal: p.expectedTotal ?? null,
    produced: p.produced ?? null,
    falsePositives: p.falsePositives ?? null,
    kept: p.kept ?? null,
    dropped: p.dropped ?? null,
  };
}

const D = (iso: string) => new Date(iso);

describe('groupVersionRuns', () => {
  it('dedupes a case run twice at the same version to the latest row (AC-6)', () => {
    const rows = [
      makeRow({
        caseId: 'c1',
        agentVersion: 5,
        ranAt: D('2026-05-01T00:00:00Z'),
        pass: false,
        matched: 0,
        expectedTotal: 1,
        produced: 1,
        falsePositives: 1,
        kept: 0,
        dropped: 1,
      }),
      makeRow({
        caseId: 'c1',
        agentVersion: 5,
        ranAt: D('2026-05-02T00:00:00Z'), // newer — should win
        pass: true,
        matched: 1,
        expectedTotal: 1,
        produced: 1,
        falsePositives: 0,
        kept: 1,
        dropped: 0,
      }),
    ];

    const [run] = groupVersionRuns(rows, 5);
    expect(run).toBeDefined();
    expect(run!.casesTotal).toBe(1);
    expect(run!.casesPassed).toBe(1); // from the newer, passing row
    expect(run!.recall).toBe(1); // matched 1 / expected 1
    expect(run!.ranAt).toEqual(D('2026-05-02T00:00:00Z'));
  });

  it('pools the raw counts identically to the scorer (AC-7)', () => {
    // Two distinct cases at one version — a 1-expectation case and a
    // 10-expectation one, so an unweighted mean-of-ratios would diverge.
    const rows = [
      makeRow({
        caseId: 'c1',
        agentVersion: 3,
        ranAt: D('2026-05-01T00:00:00Z'),
        pass: true,
        matched: 1,
        expectedTotal: 1,
        produced: 1,
        falsePositives: 0,
        kept: 1,
        dropped: 0,
      }),
      makeRow({
        caseId: 'c2',
        agentVersion: 3,
        ranAt: D('2026-05-01T00:00:00Z'),
        pass: false,
        matched: 5,
        expectedTotal: 10,
        produced: 8,
        falsePositives: 3,
        kept: 5,
        dropped: 5,
      }),
    ];

    const [run] = groupVersionRuns(rows, 3);
    const scorer = aggregateRunRows(rows);

    expect(run!.recall).toBeCloseTo(scorer.recall, 10);
    expect(run!.precision).toBeCloseTo(scorer.precision, 10);
    expect(run!.citationAccuracy).toBeCloseTo(scorer.citation_accuracy, 10);
    expect(run!.casesPassed).toBe(scorer.traces_passed);
  });

  it('returns one entry per version, newest-first (AC-9, AC-23)', () => {
    const rows = [
      makeRow({ caseId: 'c1', agentVersion: 5, ranAt: D('2026-05-01T00:00:00Z'), expectedTotal: 0 }),
      makeRow({ caseId: 'c1', agentVersion: 6, ranAt: D('2026-06-01T00:00:00Z'), expectedTotal: 0 }),
      makeRow({ caseId: 'c2', agentVersion: 6, ranAt: D('2026-06-01T00:00:00Z'), expectedTotal: 0 }),
    ];

    const runs = groupVersionRuns(rows, 6);
    expect(runs.map((r) => r.agentVersion)).toEqual([6, 5]); // unique + newest-first
  });

  it('falls back to the current version for null agent_version rows', () => {
    const rows = [
      makeRow({ caseId: 'c1', agentVersion: null, ranAt: D('2026-05-01T00:00:00Z'), expectedTotal: 0 }),
    ];
    const [run] = groupVersionRuns(rows, 9);
    expect(run!.agentVersion).toBe(9);
  });

  it('reports cost null (not 0) when no run in the version has a cost', () => {
    const rows = [
      makeRow({ caseId: 'c1', agentVersion: 4, ranAt: D('2026-05-01T00:00:00Z'), costUsd: null, expectedTotal: 0 }),
    ];
    const [run] = groupVersionRuns(rows, 4);
    expect(run!.costUsd).toBeNull();
  });

  it('sums the non-null costs when at least one run reports a cost', () => {
    const rows = [
      makeRow({ caseId: 'c1', agentVersion: 4, ranAt: D('2026-05-01T00:00:00Z'), costUsd: 0.1, expectedTotal: 0 }),
      makeRow({ caseId: 'c2', agentVersion: 4, ranAt: D('2026-05-01T00:00:00Z'), costUsd: null, expectedTotal: 0 }),
    ];
    const [run] = groupVersionRuns(rows, 4);
    expect(run!.costUsd).toBeCloseTo(0.1, 10);
  });
});

describe('buildTrend', () => {
  it('is one point per version in chronological ascending order (AC-16, AC-17)', () => {
    const rows = [
      makeRow({ caseId: 'c1', agentVersion: 5, ranAt: D('2026-05-01T00:00:00Z'), expectedTotal: 0 }),
      makeRow({ caseId: 'c1', agentVersion: 6, ranAt: D('2026-06-01T00:00:00Z'), expectedTotal: 0 }),
      makeRow({ caseId: 'c1', agentVersion: 7, ranAt: D('2026-07-01T00:00:00Z'), expectedTotal: 0 }),
    ];
    const trend = buildTrend(groupVersionRuns(rows, 7));
    expect(trend.map((p) => p.agentVersion)).toEqual([5, 6, 7]); // oldest → newest
  });
});

describe('measuredVersions + metricDelta', () => {
  it('delta is between the two most-recently-measured versions, never the unmeasured current (AC-14)', () => {
    // Runs exist at v5 and v6; the agent is now at an unmeasured v7.
    const rows = [
      makeRow({ caseId: 'c1', agentVersion: 5, ranAt: D('2026-05-01T00:00:00Z'), matched: 8, expectedTotal: 10 }),
      makeRow({ caseId: 'c1', agentVersion: 6, ranAt: D('2026-06-01T00:00:00Z'), matched: 9, expectedTotal: 10 }),
    ];
    const runs = groupVersionRuns(rows, 7);
    const { measured, previous } = measuredVersions(runs);

    expect(measured!.agentVersion).toBe(6);
    expect(previous!.agentVersion).toBe(5);

    const delta = metricDelta(measured, previous);
    expect(delta).not.toBeNull();
    expect(delta!.recall).toBeCloseTo(0.9 - 0.8, 10); // v6 − v5, not anything about v7
  });

  it('returns no delta when there is no previous measured version (AC-13)', () => {
    const rows = [
      makeRow({ caseId: 'c1', agentVersion: 6, ranAt: D('2026-06-01T00:00:00Z'), expectedTotal: 0 }),
    ];
    const { measured, previous } = measuredVersions(groupVersionRuns(rows, 6));
    expect(previous).toBeNull();
    expect(metricDelta(measured, previous)).toBeNull();
  });
});

describe('filterByDays', () => {
  it('keeps only version runs within the range, leaving grouping (cards) untouched (AC-20/22)', () => {
    const now = D('2026-07-15T00:00:00Z');
    const rows = [
      makeRow({ caseId: 'c1', agentVersion: 5, ranAt: D('2026-05-01T00:00:00Z'), expectedTotal: 0 }), // 75d ago
      makeRow({ caseId: 'c2', agentVersion: 6, ranAt: D('2026-07-10T00:00:00Z'), expectedTotal: 0 }), // 5d ago
    ];
    const runs = groupVersionRuns(rows, 6);
    expect(runs).toHaveLength(2); // grouping keeps both versions

    const within7 = filterByDays(runs, 7, now);
    expect(within7.map((r) => r.agentVersion)).toEqual([6]); // only the recent one

    const within90 = filterByDays(runs, 90, now);
    expect(within90).toHaveLength(2);
  });
});
