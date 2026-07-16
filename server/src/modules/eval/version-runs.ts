/**
 * eval/version-runs.ts — pure version-run grouping, pooling, trend, range,
 * delta (T3, SPEC-04-eval-dashboard).
 *
 * No Drizzle, no Fastify, no container import — same constraints as
 * `scorer.ts:1-7`. Imports nothing outside `./scorer.js`, `./types.js` and
 * `@devdigest/shared`.
 *
 * Terminology (spec "Problem & why"): an **eval version run** is the pooled
 * result of the latest `eval_runs` row per case at one `agent_version` — the
 * same "latest run per case within one agent version" rule the metric cards
 * already use (`service.ts:119`, `deduplicateLatestPerCase`), promoted to a
 * first-class, named thing.
 */

import { poolMetrics } from './scorer.js';
import type { EvalRunRow } from './types.js';

// ── Internal version-run shape ──────────────────────────────────────────────

/**
 * Internal (NOT wire) representation of an eval version run. Carries
 * `falsePositives` in addition to every field the `EvalVersionRun` Zod
 * contract exposes, because T4's regression banner needs the raw pooled
 * false-positive count (AC-31) to compose "a new false positive slipped in" —
 * `false_positives` is deliberately not part of the wire contract.
 *
 * `EvalService` (T5/T6) is responsible for mapping this to `EvalVersionRun`
 * through a DTO mapper before it leaves the service (server INSIGHTS: raw
 * internal shapes must never cross the HTTP boundary directly).
 */
export interface VersionRun {
  agentVersion: number;
  ranAt: Date;
  recall: number;
  precision: number;
  citationAccuracy: number;
  casesPassed: number;
  casesTotal: number;
  costUsd: number | null;
  falsePositives: number;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Given a list of `EvalRunRow`, returns only the latest (newest `ranAt`) row
 * per `caseId`. Mirrors `deduplicateLatestPerCase` in `service.ts:119` —
 * the canonical "latest run per case" rule — but sorts defensively first
 * since callers here are not guaranteed to hand rows in `ranAt DESC` order
 * (input may span every agent version, pre-grouping).
 */
function deduplicateLatestPerCase(rows: EvalRunRow[]): EvalRunRow[] {
  const sorted = [...rows].sort((a, b) => b.ranAt.getTime() - a.ranAt.getTime());
  const seen = new Set<string>();
  return sorted.filter((r) => {
    if (seen.has(r.caseId)) return false;
    seen.add(r.caseId);
    return true;
  });
}

// ── groupVersionRuns ─────────────────────────────────────────────────────────

/**
 * Groups raw `eval_runs` rows into one `VersionRun` per `agent_version`.
 *
 * Rows with a null `agent_version` (predating migration `0016`) fall back to
 * `currentVersion`, the caller-supplied agent's current version — this is
 * the second parameter's role.
 *
 * For each version: dedupe to the latest row per case (AC-6), `ranAt` = the
 * newest of those rows, `costUsd` = the sum of their non-null `cost_usd`
 * (`null` when none reported — the "cost missing" edge case), the three
 * metrics come from `poolMetrics()` over the pooled RAW COUNTS — never an
 * average of the stored per-case ratios (AC-6, AC-7; server INSIGHTS: a
 * ratio cannot be re-aggregated) — `casesPassed` counts `pass === true`
 * rows, never re-derived from a metric (server INSIGHTS: never re-derive a
 * verdict the scorer already emitted), and `casesTotal` is the number of
 * distinct cases folded into that version (the deduped set's size).
 *
 * Result is sorted newest-first by `ranAt` (AC-9) and unique by version
 * (AC-23, by construction — one Map entry per `agent_version`).
 */
export function groupVersionRuns(rows: EvalRunRow[], currentVersion: number): VersionRun[] {
  const byVersion = new Map<number, EvalRunRow[]>();
  for (const row of rows) {
    const version = row.agentVersion ?? currentVersion;
    const bucket = byVersion.get(version);
    if (bucket) {
      bucket.push(row);
    } else {
      byVersion.set(version, [row]);
    }
  }

  const versionRuns: VersionRun[] = [];

  for (const [agentVersion, groupRows] of byVersion) {
    // Newest-first order; latestPerCase[0] is therefore the newest ranAt.
    const latestPerCase = deduplicateLatestPerCase(groupRows);

    let totalExpected = 0;
    let totalMatched = 0;
    let totalFalsePositives = 0;
    let totalProduced = 0;
    let totalKept = 0;
    let totalDropped = 0;
    let casesPassed = 0;
    let costSum = 0;
    let costCount = 0;

    for (const r of latestPerCase) {
      if (r.pass === true) casesPassed++;
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
      traces_passed: casesPassed,
      traces_total: latestPerCase.length,
    });

    versionRuns.push({
      agentVersion,
      ranAt: latestPerCase[0]!.ranAt,
      recall: pooled.recall,
      precision: pooled.precision,
      citationAccuracy: pooled.citation_accuracy,
      casesPassed,
      casesTotal: latestPerCase.length,
      costUsd: costCount > 0 ? costSum : null,
      falsePositives: totalFalsePositives,
    });
  }

  return versionRuns.sort((a, b) => b.ranAt.getTime() - a.ranAt.getTime());
}

// ── filterByDays ─────────────────────────────────────────────────────────────

/**
 * Range filter used for the trend and the run list ONLY (AC-20) — the
 * metric cards and their deltas are computed from `measuredVersions()` over
 * the unfiltered `groupVersionRuns()` output, independently of `days`
 * (AC-22), so callers must not pass a filtered list into `measuredVersions`.
 */
export function filterByDays(
  versionRuns: VersionRun[],
  days: number,
  now: Date = new Date(),
): VersionRun[] {
  const cutoffMs = now.getTime() - days * 24 * 60 * 60 * 1000;
  return versionRuns.filter((v) => v.ranAt.getTime() >= cutoffMs);
}

// ── buildTrend ───────────────────────────────────────────────────────────────

/**
 * One point per agent version, ordered chronologically ascending by `ranAt`
 * (AC-16, AC-17). Each point is already a `VersionRun` — it inherently
 * carries `agentVersion` and the version's latest pooled metrics; mapping to
 * the `EvalTrendPoint` wire shape (pass_rate, cost_usd, etc.) is the
 * service's job (T5), not this pure module's (no HTTP shapes here).
 */
export function buildTrend(versionRuns: VersionRun[]): VersionRun[] {
  return [...versionRuns].sort((a, b) => a.ranAt.getTime() - b.ranAt.getTime());
}

// ── measuredVersions ─────────────────────────────────────────────────────────

/**
 * The two most recently measured versions, from a newest-first
 * `groupVersionRuns()` result. Never a measured-vs-unmeasured-current delta
 * (AC-13, AC-14) — both `measured` and `previous` are, by construction,
 * versions that actually have at least one run.
 */
export function measuredVersions(versionRuns: VersionRun[]): {
  measured: VersionRun | null;
  previous: VersionRun | null;
} {
  return {
    measured: versionRuns[0] ?? null,
    previous: versionRuns[1] ?? null,
  };
}

// ── metricDelta ──────────────────────────────────────────────────────────────

/**
 * The delta between the measured version and the previous measured version,
 * or `null` when there is no previous measured version (AC-13).
 */
export function metricDelta(
  measured: VersionRun | null,
  previous: VersionRun | null,
): { recall: number; precision: number; citation_accuracy: number } | null {
  if (measured === null || previous === null) return null;
  return {
    recall: measured.recall - previous.recall,
    precision: measured.precision - previous.precision,
    citation_accuracy: measured.citationAccuracy - previous.citationAccuracy,
  };
}
