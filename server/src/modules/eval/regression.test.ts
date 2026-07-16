import { describe, it, expect } from 'vitest';
import { composeRegressionBanner } from './regression.js';
import type { VersionRun } from './version-runs.js';

/**
 * Unit coverage for the pure deterministic banner composer (T25 / SPEC-04).
 * No LLM, no DB — two VersionRuns in, one sentence (or null) out.
 */

function makeVR(p: Partial<VersionRun> & { agentVersion: number }): VersionRun {
  return {
    agentVersion: p.agentVersion,
    ranAt: p.ranAt ?? new Date('2026-07-01T00:00:00Z'),
    recall: p.recall ?? 1,
    precision: p.precision ?? 1,
    citationAccuracy: p.citationAccuracy ?? 1,
    casesPassed: p.casesPassed ?? 0,
    casesTotal: p.casesTotal ?? 0,
    costUsd: p.costUsd ?? null,
    falsePositives: p.falsePositives ?? 0,
  };
}

describe('composeRegressionBanner', () => {
  it('flags a metric that dropped ≥ 1 point, naming metric, drop, and version (AC-30)', () => {
    const banner = composeRegressionBanner({
      measured: makeVR({ agentVersion: 7, recall: 0.85 }),
      previous: makeVR({ agentVersion: 6, recall: 0.9 }),
    });
    expect(banner).toBe('Recall dipped 5pts on v7.');
  });

  it('does not flag a sub-1-point dip (AC-30 threshold)', () => {
    const banner = composeRegressionBanner({
      measured: makeVR({ agentVersion: 7, recall: 0.899 }),
      previous: makeVR({ agentVersion: 6, recall: 0.9 }), // 0.1pt — below threshold
    });
    expect(banner).toBeNull();
  });

  it('appends the false-positive clause when precision regressed and FP rose (AC-31)', () => {
    const banner = composeRegressionBanner({
      measured: makeVR({ agentVersion: 7, precision: 0.9, falsePositives: 3 }),
      previous: makeVR({ agentVersion: 6, precision: 0.92, falsePositives: 1 }),
    });
    expect(banner).toBe('Precision dipped 2pts on v7 — a new false positive slipped in.');
  });

  it('does not append the FP clause when precision regressed but FP did not rise', () => {
    const banner = composeRegressionBanner({
      measured: makeVR({ agentVersion: 7, precision: 0.9, falsePositives: 1 }),
      previous: makeVR({ agentVersion: 6, precision: 0.92, falsePositives: 1 }),
    });
    expect(banner).toBe('Precision dipped 2pts on v7.');
  });

  it('names improved metrics alongside the regression (AC-32) — matches the mock target', () => {
    const banner = composeRegressionBanner({
      measured: makeVR({ agentVersion: 7, recall: 0.9, precision: 0.9, citationAccuracy: 0.88, falsePositives: 3 }),
      previous: makeVR({ agentVersion: 6, recall: 0.8, precision: 0.92, citationAccuracy: 0.85, falsePositives: 1 }),
    });
    expect(banner).toBe('Precision dipped 2pts on v7 — a new false positive slipped in. Recall and citation both up.');
  });

  it('returns null when nothing regressed (AC-34)', () => {
    const banner = composeRegressionBanner({
      measured: makeVR({ agentVersion: 7, recall: 0.95, precision: 0.95, citationAccuracy: 0.95 }),
      previous: makeVR({ agentVersion: 6, recall: 0.9, precision: 0.9, citationAccuracy: 0.9 }),
    });
    expect(banner).toBeNull();
  });

  it('returns null when there is no previous measured version (AC-34)', () => {
    expect(composeRegressionBanner({ measured: makeVR({ agentVersion: 7 }), previous: null })).toBeNull();
    expect(composeRegressionBanner({ measured: null, previous: null })).toBeNull();
  });
});
