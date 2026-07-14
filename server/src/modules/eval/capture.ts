/**
 * Pure frozen-enrichment builder (T6, SPEC-03).
 *
 * Reads fields from a run trace and the caller-computed rank note to produce
 * the immutable enrichment block stored on every eval case. No I/O, no await.
 */
import type { RunTrace } from '@devdigest/shared';
import type { EvalEnrichment } from './types.js';

const EMPTY_ENRICHMENT: EvalEnrichment = {
  callers: null,
  repo_map: null,
  rank_note: '',
  intent: null,
  context_docs: [],
};

/**
 * Build the frozen enrichment block for an eval case.
 *
 * - `trace`    — the originating run's persisted RunTrace. Null/undefined
 *               (e.g. trace not yet written, or fetch error) yields an
 *               all-empty enrichment; never throws.
 * - `intent`   — the structured stored-intent object for the PR, obtained by
 *               the caller from `intentRepo`. NEVER pass
 *               `trace.prompt_assembly.intent` (that is the already-wrapped
 *               rendered section — passing it back would double-wrap on replay).
 * - `rankNote` — the sentence the caller computed via `rankNoteSentence()`,
 *               or `''` when no hot files or on error.
 */
export function buildEnrichment({
  trace,
  intent,
  rankNote,
}: {
  trace: RunTrace | null | undefined;
  intent: EvalEnrichment['intent'];
  rankNote: string;
}): EvalEnrichment {
  if (!trace) {
    return { ...EMPTY_ENRICHMENT };
  }

  return {
    callers: trace.prompt_assembly.callers ?? null,
    repo_map: trace.prompt_assembly.repo_map ?? null,
    rank_note: rankNote,
    intent,
    // AC-15: drop any entry whose content could not be read at capture time.
    context_docs: trace.specs_read.filter(
      (d): d is { path: string; content: string } => d.content !== null,
    ),
  };
}
