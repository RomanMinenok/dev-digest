/**
 * eval — module-local domain types (T3, SPEC-03).
 *
 * Pure TypeScript interfaces only — no drizzle-orm or fastify imports.
 * Drizzle row types are derived via $inferSelect (schema import only).
 * ExpectedFinding is re-exported from the shared contract.
 */

import type { evalCases, evalRuns } from '../../db/schema/eval.js';

// ── Re-exports from shared contract ───────────────────────────────────────

export type { ExpectedFinding } from '@devdigest/shared';

// ── Drizzle row types (schema $inferSelect, no drizzle-orm import) ────────

/** Row shape as stored in `eval_cases`. */
export type EvalCaseRow = typeof evalCases.$inferSelect;

/** Row shape as stored in `eval_runs`. */
export type EvalRunRow = typeof evalRuns.$inferSelect;

// ── Enrichment / input-meta shapes ────────────────────────────────────────

/** The enrichment block carried inside an eval case's `input_meta`. */
export interface EvalEnrichment {
  callers: string | null;
  repo_map: string | null;
  rank_note: string;
  intent: {
    intent: string;
    in_scope: string[];
    out_of_scope: string[];
  } | null;
  /** Project-context documents that were attached during the source review run. */
  context_docs: { path: string; content: string }[];
}

/** Provenance back to the source finding / review / run that seeded this case. */
export interface EvalCaseSource {
  finding_id: string;
  review_id: string;
  run_id: string;
  pr_id: string;
}

/**
 * Typed representation of the `input_meta` JSONB column for eval cases
 * sourced from a real review run. Aligns with `EvalCaseInputMeta` in
 * the shared contract.
 */
export interface EvalInputMeta {
  pr: {
    number: number;
    title: string;
    body: string;
    author: string;
  };
  enrichment: EvalEnrichment;
  source: EvalCaseSource;
}

// ── Scoring types ─────────────────────────────────────────────────────────

/**
 * Per-case scoring result from a single eval run.
 *
 * - `matched`        — expected findings that were reproduced (true positives)
 * - `expectedTotal`  — total expected findings in the case
 * - `produced`       — total findings produced by the agent
 * - `falsePositives` — produced findings not matching any expected finding
 * - `kept`           — produced findings that map to a kept (matched) expected
 * - `dropped`        — expected findings the agent missed
 */
export interface CaseScore {
  pass: boolean;
  matched: number;
  expectedTotal: number;
  produced: number;
  falsePositives: number;
  kept: number;
  dropped: number;
}

/**
 * Aggregate result of executing a full eval set (all cases for one run).
 * Each entry in `cases` maps a case id to its per-case score; the top-level
 * fields are the set-level statistics.
 */
export interface RunSetResult {
  cases: Array<{ caseId: string; score: CaseScore }>;
  passRate: number;
  recall: number;
  precision: number;
}
