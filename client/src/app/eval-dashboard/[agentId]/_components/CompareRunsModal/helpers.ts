/* CompareRunsModal/helpers.ts — pure, line-level system-prompt diff (T18).

   No React, no new dependency (an LCS is enough — the modal only ever diffs two
   short prompt strings). Exported for the modal (AC-25) and its
   "no prompt changes" state (AC-26). Kept in helpers.ts per the route's
   `_components` convention — no side effects, no JSX. */

/** One line of the rendered diff. `same` lines appear in both prompts; `del`
    lines were removed from the old prompt; `add` lines were added in the new. */
export interface DiffLine {
  kind: "same" | "add" | "del";
  text: string;
}

/** True when the two prompts are byte-identical — the modal renders the
    "no prompt changes" state (AC-26) instead of an all-`same` diff pane. */
export function promptsAreIdentical(oldPrompt: string, newPrompt: string): boolean {
  return oldPrompt === newPrompt;
}

/**
 * Line-level diff via longest-common-subsequence (Myers-style LCS table).
 *
 * Splits both prompts on newlines, computes the LCS of the two line arrays,
 * then walks it to emit `del` (only in old), `add` (only in new), and `same`
 * (in both) lines in reading order. O(n·m) time/space over line counts — fine
 * for two system prompts (tens to low-hundreds of lines).
 */
export function diffPromptLines(oldPrompt: string, newPrompt: string): DiffLine[] {
  const a = oldPrompt.split("\n");
  const b = newPrompt.split("\n");
  const n = a.length;
  const m = b.length;

  // lcs[i][j] = length of the LCS of a[i..] and b[j..]. Every index below is
  // provably in-bounds, so the non-null assertions are safe (the tsconfig has
  // noUncheckedIndexedAccess on, which cannot see that).
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    const row = lcs[i]!;
    const rowNext = lcs[i + 1]!;
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? rowNext[j + 1]! + 1 : Math.max(rowNext[j]!, row[j + 1]!);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ kind: "del", text: a[i]! });
      i++;
    } else {
      out.push({ kind: "add", text: b[j]! });
      j++;
    }
  }
  while (i < n) {
    out.push({ kind: "del", text: a[i]! });
    i++;
  }
  while (j < m) {
    out.push({ kind: "add", text: b[j]! });
    j++;
  }
  return out;
}
