import type { Risk, ReviewFocusItem } from '@devdigest/shared';
import type { BriefResult } from './brief-prompt.js';

/**
 * Anti-hallucination gate for the LLM-generated PR Brief output.
 *
 * The brief prompt (`brief-prompt.ts`) can return `review_focus[].path` and
 * `risks[].file_refs` entries that don't correspond to any file actually
 * changed in the PR (a hallucinated reference). This function is the
 * verification step: it drops anything that doesn't match a real changed
 * path, following the same literal-`includes()` verification pattern used
 * for LLM-extracted conventions (see `modules/conventions/extractor.ts`).
 *
 * Pure function: no I/O, no container — `changedPaths` is supplied by the
 * caller as plain data.
 */
export function validateBriefOutput(
  result: BriefResult,
  changedPaths: string[],
): { risks: Risk[]; review_focus: ReviewFocusItem[] } {
  const review_focus = result.review_focus.filter((item) => changedPaths.includes(item.path));

  const risks = result.risks
    .map((risk) => ({
      ...risk,
      file_refs: risk.file_refs.filter((path) => changedPaths.includes(path)),
    }))
    .filter((risk) => risk.file_refs.length > 0);

  return { risks, review_focus };
}
