/**
 * eval/scorer.ts — pure scoring functions (T4, SPEC-03).
 *
 * No LLM, no DB, no adapter imports — only module-local types (AC-29).
 * Mirrors the pure-module pattern of `modules/pulls/classifier.ts`
 * and `modules/brief/validate.ts`.
 */

import type { ExpectedFinding, CaseScore, EvalRunRow } from './types.js';
import type { Finding } from '@devdigest/shared';

// ── Acceptance-criteria constants ─────────────────────────────────────────────
//
// AC-21: matching coordinates = identical `file` + intersecting line range,
// tolerating a ±LINE_TOLERANCE drift on the produced (actual) range only —
// the expected range from the eval case is never widened.
// AC-22: severity / category / title are ignored — coordinates only.
// AC-24: recall = 1 when no expectations exist in the entire run.
// AC-25: false positives = produced findings for a case whose `expected` is empty.
// AC-26: precision = 1 when no case has an empty expectation.
// AC-28: citation_accuracy = kept / (kept + dropped); = 1 when nothing produced pre-gate.
// AC-29: no LLM, no DB, no adapter in this file.
// AC-30: pass ↔ every expectation matched AND (empty expected → zero produced).

// ── matchesExpectation ────────────────────────────────────────────────────────

// Added after real eval runs showed exact-line matching produce false
// negatives (e.g. `truthiness-trap-drops-valid-falsy-settings-values`:
// expected line 53, agent cited line 52 — recall scored 0% despite a correct
// finding). Tolerance applied to the produced (actual) range only (AC-21).
const LINE_TOLERANCE = 3;

/**
 * Returns `true` when `produced` satisfies `expected` (AC-21, AC-22):
 * - identical `file`, AND
 * - intersecting line ranges, where touching boundaries count as intersecting,
 *   and the produced range is widened by ±LINE_TOLERANCE lines to absorb the
 *   agent citing a line a few rows off from the eval case's exact expectation.
 *
 * An expectation with no `end_line` is treated as a one-line range
 * `[start_line, start_line]`.
 *
 * Severity, category, and title are deliberately ignored (AC-22).
 */
export function matchesExpectation(expected: ExpectedFinding, produced: Finding): boolean {
  if (expected.file !== produced.file) return false;

  const eStart = expected.start_line;
  const eEnd = expected.end_line ?? expected.start_line;
  const pStart = produced.start_line - LINE_TOLERANCE;
  const pEnd = produced.end_line + LINE_TOLERANCE;

  // Two closed ranges [a,b] and [c,d] intersect iff a ≤ d AND c ≤ b.
  // Touching boundaries (a === d or b === c) count as intersecting (AC-21).
  return eStart <= pEnd && pStart <= eEnd;
}

// ── scoreCase ─────────────────────────────────────────────────────────────────

/**
 * Scores one eval case.
 *
 * @param expected  - The expectations declared on the case.
 * @param produced  - The findings the agent actually emitted (post-grounding kept set).
 * @param kept      - Count of produced findings that passed the grounding gate.
 * @param dropped   - Count of candidate findings the grounding gate removed.
 */
export function scoreCase({
  expected,
  produced,
  kept,
  dropped,
}: {
  expected: ExpectedFinding[];
  produced: Finding[];
  kept: number;
  dropped: number;
}): CaseScore {
  const matched = expected.filter((e) => produced.some((p) => matchesExpectation(e, p))).length;

  // AC-25: false positives are only counted for empty-expected cases.
  // Any produced finding on such a case is a FP, regardless of what it says.
  const falsePositives = expected.length === 0 ? produced.length : 0;

  // AC-30: pass when every expectation is matched; or, for empty-expected
  // cases, when the agent produces nothing.
  const pass =
    expected.length === 0 ? produced.length === 0 : matched === expected.length;

  return {
    pass,
    matched,
    expectedTotal: expected.length,
    produced: produced.length,
    falsePositives,
    kept,
    dropped,
  };
}

// ── aggregate ─────────────────────────────────────────────────────────────────

/**
 * Aggregates per-case scores into run-level metrics.
 *
 * Empty-set rules (ACs 24, 26, 28):
 * - `recall`            = 1 when no expectations exist anywhere in the run.
 * - `precision`         = 1 when no case has an empty expectation (→ no FPs).
 * - `citation_accuracy` = 1 when nothing was produced pre-grounding-gate.
 */
export function aggregate(caseScores: CaseScore[]): {
  recall: number;
  precision: number;
  citation_accuracy: number;
  traces_passed: number;
  traces_total: number;
} {
  let totalExpected = 0;
  let totalMatched = 0;
  let totalFalsePositives = 0;
  let totalKept = 0;
  let totalDropped = 0;
  let traces_passed = 0;

  for (const cs of caseScores) {
    totalExpected += cs.expectedTotal;
    totalMatched += cs.matched;
    totalFalsePositives += cs.falsePositives;
    totalKept += cs.kept;
    totalDropped += cs.dropped;
    if (cs.pass) traces_passed++;
  }

  let totalProduced = 0;
  for (const cs of caseScores) totalProduced += cs.produced;

  return poolMetrics({
    totalExpected,
    totalMatched,
    totalFalsePositives,
    totalProduced,
    totalKept,
    totalDropped,
    traces_passed,
    traces_total: caseScores.length,
  });
}

// ── poolMetrics ───────────────────────────────────────────────────────────────

/**
 * The single definition of the three run-level metrics, shared by `aggregate()`
 * (scoring a live run) and `aggregateRunRows()` (rebuilding the dashboard from
 * persisted runs). Both pool RAW COUNTS across the run — never average per-case
 * ratios, which would weight a 1-expectation case the same as a 10-expectation
 * one (AC-23 / AC-25 / AC-27 all say "across the cases in the run").
 */
export function poolMetrics({
  totalExpected,
  totalMatched,
  totalFalsePositives,
  totalProduced,
  totalKept,
  totalDropped,
  traces_passed,
  traces_total,
}: {
  totalExpected: number;
  totalMatched: number;
  totalFalsePositives: number;
  totalProduced: number;
  totalKept: number;
  totalDropped: number;
  traces_passed: number;
  traces_total: number;
}): {
  recall: number;
  precision: number;
  citation_accuracy: number;
  traces_passed: number;
  traces_total: number;
} {
  // AC-23/24: recall = matched / expected across the run; 1 when no expectations exist.
  const recall = totalExpected === 0 ? 1 : totalMatched / totalExpected;

  // AC-25/26: precision = 1 − FP / total findings produced across the run.
  // 1 when the run produced nothing, or when no case has an empty expectation
  // (the only shape that can yield a false positive) — both make FP = 0.
  const precision = totalProduced === 0 ? 1 : 1 - totalFalsePositives / totalProduced;

  // AC-27/28: citation_accuracy = kept / (kept + dropped); 1 when nothing produced pre-gate.
  const citation_accuracy =
    totalKept + totalDropped === 0 ? 1 : totalKept / (totalKept + totalDropped);

  return { recall, precision, citation_accuracy, traces_passed, traces_total };
}

// ── aggregateRunRows ───────────────────────────────────────────────────────────

/**
 * Aggregates stored eval run rows (already deduplicated to latest-per-case
 * within one agent version) into dashboard-level metrics.
 *
 * Pools the RAW COUNTS persisted on each run (`matched`, `expectedTotal`,
 * `produced`, `falsePositives`, `kept`, `dropped`) through the same
 * `poolMetrics` used to score a live run, so the dashboard number and the
 * number shown right after a run are computed identically. Averaging the
 * stored per-case ratios instead would give a 1-expectation case the same
 * weight as a 10-expectation one, which is not what AC-23/25/27 define.
 *
 * A failed run (the model call threw — see `EvalService.runCases`) has null
 * counts and null metrics. It still counts toward `traces_total` and is never
 * `traces_passed`, but it contributes nothing to the pooled ratios: a case that
 * never produced an answer is not evidence about the agent's recall.
 *
 * Empty input (no runs for this version) → all-zero metrics and
 * `traces_total: 0`, which the client reads as "unavailable" rather than 0%.
 */
export function aggregateRunRows(rows: EvalRunRow[]): {
  recall: number;
  precision: number;
  citation_accuracy: number;
  traces_passed: number;
  traces_total: number;
  cost_usd: number | null;
} {
  if (rows.length === 0) {
    return {
      recall: 0,
      precision: 0,
      citation_accuracy: 0,
      traces_passed: 0,
      traces_total: 0,
      cost_usd: null,
    };
  }

  let traces_passed = 0;
  let totalExpected = 0;
  let totalMatched = 0;
  let totalFalsePositives = 0;
  let totalProduced = 0;
  let totalKept = 0;
  let totalDropped = 0;
  let costSum = 0;
  let costCount = 0;

  for (const r of rows) {
    if (r.pass === true) traces_passed++;
    totalExpected += r.expectedTotal ?? 0;
    totalMatched += r.matched ?? 0;
    totalFalsePositives += r.falsePositives ?? 0;
    totalProduced += r.produced ?? 0;
    totalKept += r.kept ?? 0;
    totalDropped += r.dropped ?? 0;
    if (r.costUsd != null) {
      costSum += r.costUsd;
      costCount++;
    }
  }

  const pooled = poolMetrics({
    totalExpected,
    totalMatched,
    totalFalsePositives,
    totalProduced,
    totalKept,
    totalDropped,
    traces_passed,
    traces_total: rows.length,
  });

  return { ...pooled, cost_usd: costCount > 0 ? costSum : null };
}
