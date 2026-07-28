import type { Finding } from '@devdigest/shared';

/**
 * Module-local types for multi-agent review grouping (SPEC-05, T-04).
 * These are NOT wire contracts — the snake_case wire shapes are T-09's job.
 * Pure domain shapes only: no I/O, no framework, no adapter types.
 */

/**
 * A `Finding` plus the attribution needed to trace it back to the agent run
 * that produced it (AC-32 — attribution must survive grouping).
 */
export interface AttributedFinding {
  finding: Finding;
  agentId: string;
  runId: string;
}

/**
 * One location group: every `AttributedFinding` whose coordinates chain
 * together via `sameLocation` (see `grouping.ts` for the transitive rule).
 */
export interface LocationGroup {
  file: string;
  /** Min `start_line` across the group's findings — used for stable sort. */
  minStartLine: number;
  /** Min `end_line` across the group's findings — used for stable sort. */
  minEndLine: number;
  findings: AttributedFinding[];
}
