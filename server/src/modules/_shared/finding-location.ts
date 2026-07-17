/**
 * Shared "same location" coordinate rule for findings, currently used by
 * `eval/scorer.ts` (`matchesExpectation`, AC-21/AC-22) and about to be used by
 * multi-agent review grouping (SPEC-05 AC-29/AC-30/T-04). Pure — no I/O, no
 * framework, module-local types only.
 *
 * A location is "the same" as another when they share the same `file` AND
 * their `[start_line, end_line]` ranges intersect, with `b`'s range widened
 * by ±`LINE_TOLERANCE` lines on both ends before the intersection check.
 * Touching boundaries count as intersecting.
 *
 * ## Why the widening is one-sided (and why that's still symmetric)
 *
 * `eval/scorer.ts` deliberately widens only the *produced* (agent-reported)
 * side of a match, never the *expected* (eval-case) side — see that file's
 * header comment. Multi-agent grouping (T-04) will call `sameLocation` over
 * unordered pairs of findings, so it MUST be commutative or AC-30's
 * determinism breaks (grouping would depend on row iteration order).
 *
 * One-sided widening already IS symmetric. Let `a = [a1,a2]` be the
 * unwidened side and `b = [b1,b2]` the side to widen by tolerance `t`:
 *
 * ```
 * [a1,a2] vs [b1-t, b2+t] intersect  ⟺  a1 ≤ b2+t ∧ b1-t ≤ a2
 * swap a/b:                          ⟺  b1 ≤ a2+t ∧ a1-t ≤ b2
 * ```
 *
 * These are algebraically identical (`a1 ≤ b2+t ⟺ a1-t ≤ b2`, and likewise
 * for the other clause), so one-sided widening of *either* argument produces
 * the same boolean result regardless of which side you call "a" and which
 * you call "b". This is why `sameLocation(a, b)` can widen only `b` and
 * still be safely commutative for grouping, while also preserving
 * `matchesExpectation`'s deliberate expected-side asymmetry (callers just
 * pass `expected` as `a` and `produced` as `b`).
 *
 * Do NOT "fix" this into two-sided widening (widening both `a` and `b`) —
 * that silently doubles the effective tolerance to `2 * LINE_TOLERANCE`.
 * `LINE_TOLERANCE` was deliberately set to absorb small citation drift
 * (see `eval/scorer.ts`'s history comment on the constant); doubling it is
 * not wanted and would shift SPEC-03/SPEC-04 eval metrics.
 */

// Added after real eval runs showed exact-line matching produce false
// negatives (e.g. `truthiness-trap-drops-valid-falsy-settings-values`:
// expected line 53, agent cited line 52 — recall scored 0% despite a correct
// finding). Tolerance applied to the widened (`b`) side only.
export const LINE_TOLERANCE = 10;

/** A minimal finding coordinate — just enough to compare locations. */
export interface FindingLocation {
  file: string;
  start_line: number;
  end_line: number;
}

/**
 * Returns `true` when `a` and `b` are "the same location":
 * - identical `file`, AND
 * - intersecting line ranges, where touching boundaries count as
 *   intersecting, and `b`'s range is widened by ±`LINE_TOLERANCE` lines
 *   before the intersection check (see module header for the symmetry
 *   proof and why the widening must stay one-sided).
 */
export function sameLocation(a: FindingLocation, b: FindingLocation): boolean {
  if (a.file !== b.file) return false;

  const aStart = a.start_line;
  const aEnd = a.end_line;
  const bStart = b.start_line - LINE_TOLERANCE;
  const bEnd = b.end_line + LINE_TOLERANCE;

  // Two closed ranges [a,b] and [c,d] intersect iff a ≤ d AND c ≤ b.
  return aStart <= bEnd && bStart <= aEnd;
}
