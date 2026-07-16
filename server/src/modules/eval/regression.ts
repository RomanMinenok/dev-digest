/**
 * eval/regression.ts — pure deterministic regression banner composer (T4,
 * SPEC-04-eval-dashboard).
 *
 * No LLM, no `container.llm`, no prompt (AC-33) — the banner is a template
 * composed in code from two already-computed `VersionRun`s (T3's
 * `measuredVersions()` output). No Drizzle, no Fastify, no container import —
 * same constraints as `scorer.ts:1-7` / `version-runs.ts:1-14`.
 */

import type { VersionRun } from './version-runs.js';

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * A metric counts as regressed only at ≥ 1 percentage point below the
 * previous measured version (AC-30). Compared in points (0-100), not the raw
 * 0-1 fraction, to avoid floating-point comparisons like `0.0099999 < 0.01`.
 */
const REGRESSION_THRESHOLD_POINTS = 1;

interface MetricDescriptor {
  key: 'recall' | 'precision' | 'citationAccuracy';
  label: string;
}

// Lowercase — capitalized only when it opens a sentence (see `capitalize`).
const METRICS: MetricDescriptor[] = [
  { key: 'recall', label: 'recall' },
  { key: 'precision', label: 'precision' },
  { key: 'citationAccuracy', label: 'citation' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1);
}

/** Points a metric moved by (measured − previous), rounded to the nearest point. */
function pointsDelta(measured: VersionRun, previous: VersionRun, key: MetricDescriptor['key']): number {
  return Math.round((measured[key] - previous[key]) * 100);
}

/** "a" / "a and b" / "a, b and c" — no Oxford comma, matches the mock's plain prose. */
function joinWithAnd(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// ── composeRegressionBanner ──────────────────────────────────────────────────

/**
 * Returns a one/two-sentence warning banner, or `null` when nothing regressed
 * or there is no previous measured version (AC-34).
 *
 * - Names each regressed metric, its drop in points, and the version it
 *   regressed on (AC-30).
 * - If precision regressed AND the measured version's pooled
 *   `falsePositives` exceeds the previous version's, appends that fact using
 *   the persisted counter (AC-31).
 * - Names improved metrics alongside regressed ones (AC-32).
 */
export function composeRegressionBanner({
  measured,
  previous,
}: {
  measured: VersionRun | null;
  previous: VersionRun | null;
}): string | null {
  if (measured === null || previous === null) return null;

  const regressed: { label: string; dropPoints: number; key: MetricDescriptor['key'] }[] = [];
  const improved: string[] = [];

  for (const metric of METRICS) {
    const delta = pointsDelta(measured, previous, metric.key);
    if (delta <= -REGRESSION_THRESHOLD_POINTS) {
      regressed.push({ label: metric.label, dropPoints: Math.abs(delta), key: metric.key });
    } else if (delta > 0) {
      improved.push(metric.label);
    }
  }

  if (regressed.length === 0) return null;

  const regressedSentence = capitalize(
    `${joinWithAnd(
      regressed.map((r) => `${r.label} dipped ${r.dropPoints}pts on v${measured.agentVersion}`),
    )}.`,
  );

  const precisionRegressedWithMoreFalsePositives =
    regressed.some((r) => r.key === 'precision') && measured.falsePositives > previous.falsePositives;

  const sentences = [
    precisionRegressedWithMoreFalsePositives
      ? `${regressedSentence.slice(0, -1)} — a new false positive slipped in.`
      : regressedSentence,
  ];

  if (improved.length > 0) {
    const verb = improved.length > 1 ? 'both up' : 'up';
    sentences.push(capitalize(`${joinWithAnd(improved)} ${verb}.`));
  }

  return sentences.join(' ');
}
