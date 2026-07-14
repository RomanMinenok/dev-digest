/**
 * Pure prompt-input builders for the eval runner (T6, SPEC-03).
 *
 * Maps a frozen eval case + its enrichment block into the subset of
 * ReviewInput that reviewPullRequest expects — the "case-derived" fields.
 * The caller (runner.ts) merges these with the live agent config (systemPrompt,
 * model, llm, strategy, skills, …).
 *
 * No I/O, no await, no Drizzle, no Fastify.
 */
import type { UnifiedDiff } from '@devdigest/shared';
import { reviewTaskLine } from '../reviews/helpers.js';
import { parseUnifiedDiff } from '../../adapters/git/diff-parser.js';
import type { EvalCaseRow, EvalEnrichment, EvalInputMeta } from './types.js';

/**
 * The case-derived (frozen) subset of ReviewInput.
 * The eval runner spreads this together with the live agent config.
 */
export interface CaseFrozenInputs {
  diff: UnifiedDiff;
  task?: string;
  callers?: string;
  repoMap?: string;
  intent?: { intent: string; in_scope: string[]; out_of_scope: string[] };
  prDescription?: string;
  specs?: string[];
}

/**
 * Task instruction line for an eval run: the standard task sentence + the
 * frozen rank note (decision 6, SPEC-03). Both the production run-executor and
 * this eval path call the same `reviewTaskLine` helper — they cannot drift from
 * each other.
 */
export function evalTaskLine(
  pr: { number: number; title: string; author: string },
  rankNote: string,
): string {
  return reviewTaskLine(pr.number, pr.title, pr.author ?? 'unknown') + rankNote;
}

/**
 * Map a frozen eval case + its enrichment block into the case-derived fields
 * that reviewPullRequest expects, using the same omit-when-empty spread
 * pattern as run-executor.ts:252–285.
 *
 * Keeps the `.trim().length > 0` semantics from prompt.ts:150,154 — an empty-
 * string callers or repoMap is NOT the same as an absent key to assemblePrompt.
 * The `specs` slot is fed from `enrichment.context_docs` already frozen at
 * capture time; no clone or filesystem access occurs here (AC-16).
 */
export function caseToReviewInputs(
  evalCase: EvalCaseRow,
  enrichment: EvalEnrichment,
): CaseFrozenInputs {
  const meta = evalCase.inputMeta as EvalInputMeta | null;
  const pr = meta?.pr;

  const diff = parseUnifiedDiff(evalCase.inputDiff ?? '');
  const specs = enrichment.context_docs.map((d) => d.content);

  return {
    diff,
    ...(pr ? { task: evalTaskLine(pr, enrichment.rank_note) } : {}),
    ...(enrichment.callers?.trim().length ? { callers: enrichment.callers } : {}),
    ...(enrichment.repo_map?.trim().length ? { repoMap: enrichment.repo_map } : {}),
    ...(enrichment.intent ? { intent: enrichment.intent } : {}),
    ...(pr?.body?.trim().length ? { prDescription: pr.body } : {}),
    ...(specs.length ? { specs } : {}),
  };
}
