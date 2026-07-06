import type { UnifiedDiff } from '@devdigest/shared';

/**
 * PURE — builds the compact text input fed to the Intent classifier
 * (docs/plan/intent_layer_plan.md Phase 4). No I/O, no LLM, no DB.
 *
 * Deliberately headers-only for the diff: file list + reconstructed
 * `@@ … @@` hunk headers, NEVER diff bodies — this is the token-savings
 * mechanism the plan measures against `estimateFullDiffTokens`.
 */

export interface BuildIntentInputParams {
  title: string;
  body?: string | null;
  /** Gathered narrative context from `resolveSpecContext` (may be empty). */
  specContext?: string | null;
  diff: UnifiedDiff;
}

/** Reconstruct a `@@ -oldStart,oldLines +newStart,newLines @@` header from a hunk. */
function formatHunkHeader(hunk: UnifiedDiff['files'][number]['hunks'][number]): string {
  return `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
}

function formatChangedFiles(diff: UnifiedDiff): string {
  if (diff.files.length === 0) return '(no changed files)';
  return diff.files
    .map((f) => {
      const headers = f.hunks.map(formatHunkHeader);
      const headerBlock = headers.length > 0 ? headers.join('\n') : '(no hunks)';
      return `### ${f.path} (+${f.additions}/-${f.deletions})\n${headerBlock}`;
    })
    .join('\n\n');
}

/**
 * Builds the classifier input: title; body (if present); spec context (if
 * present); then the changed-file list with ONLY reconstructed hunk headers.
 * Always returns a non-empty, valid string — even with no body/spec/diff —
 * so the classifier can still infer intent from the title + diff shape alone
 * (plan §0 graceful degradation).
 */
export function buildIntentInput(params: BuildIntentInputParams): string {
  const { title, body, specContext, diff } = params;

  const sections: string[] = [`# Title\n${title}`];

  if (body && body.trim().length > 0) {
    sections.push(`# PR description\n${body.trim()}`);
  }

  if (specContext && specContext.trim().length > 0) {
    sections.push(`# Additional context (issue/spec/docs)\n${specContext.trim()}`);
  }

  sections.push(`# Changed files (headers only, no diff bodies)\n${formatChangedFiles(diff)}`);

  return sections.join('\n\n');
}

/** Baseline token estimate of the FULL diff (raw text) — for the token-savings log. */
export function estimateFullDiffTokens(diff: UnifiedDiff, tokenizer: { count(text: string): number }): number {
  return tokenizer.count(diff.raw);
}
