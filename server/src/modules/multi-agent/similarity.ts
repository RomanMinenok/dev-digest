import type { AttributedFinding, LocationGroup } from './types.js';

/**
 * Pure title-similarity helpers for multi-agent review grouping
 * (SPEC-05 AC-40, AC-41, AC-42, AC-43).
 *
 * Grouping itself (`grouping.ts`, T-04) is coordinates-only. Title similarity
 * is used ONLY to classify an already-formed `LocationGroup` as Matched,
 * Divergent, and/or Agreed — it never changes which findings land in which
 * group.
 *
 * ## Untrusted input
 *
 * Finding `title` is model output (untrusted). It is tokenised here for pure
 * set-arithmetic only — never interpolated into SQL, never sent to a model,
 * never `eval`'d. Worst case a hostile title mis-classifies its OWN group as
 * Divergent or Agreed; it cannot affect grouping (coordinates only) and
 * cannot reach a shell, a query, or a model.
 */

/**
 * Case-folded, punctuation-stripped token set for a finding title.
 * Splits on any run of non-alphanumeric characters and drops empty tokens.
 */
export function titleTokens(title: string): Set<string> {
  const tokens = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
  return new Set(tokens);
}

/**
 * Jaccard similarity: |a∩b| / |a∪b|.
 *
 * Explicit empty/empty case: when BOTH sets are empty, there is no evidence
 * of agreement (no tokens to compare), so this returns `0` — NOT `1`. Do not
 * "fix" this to return 1 for the vacuously-equal case; it would make two
 * findings with unparseable/empty titles register as a perfect match.
 */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of a) {
    if (b.has(token)) intersectionSize++;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return intersectionSize / unionSize;
}

/**
 * Containment: |a∩b| / min(|a|,|b|).
 *
 * How fully the shorter title is embedded in the longer one. Catches the
 * common multi-agent pattern where one agent writes a short label
 * ("Hardcoded API Key") and another expands it — Jaccard stays mid-band
 * because the union is inflated, but containment hits 1.0.
 *
 * Either side empty → `0` (no evidence), same rationale as `jaccard`.
 */
export function containment(a: Set<string>, b: Set<string>): number {
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  if (smaller.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of smaller) {
    if (larger.has(token)) intersectionSize++;
  }
  return intersectionSize / smaller.size;
}

/**
 * Divergent threshold: cross-agent pairwise J at or below this value counts
 * as evidence of divergence. This is the requester's first guess (per the
 * spec) — expected to be tuned against real multi-agent runs, not a final
 * value. Kept here, next to the predicates, rather than at call sites.
 */
export const DIVERGENT_MAX_J = 0.3;

/**
 * Agreed threshold (Jaccard): cross-agent pairwise J at or above this value
 * counts as evidence of agreement. Same tuning caveat as `DIVERGENT_MAX_J`.
 */
export const AGREED_MIN_J = 0.6;

/**
 * Agreed threshold (containment): cross-agent pairwise containment at or
 * above this value also counts as agreement. Same numeric start as
 * `AGREED_MIN_J`, but a softer bar (denominator is min, not union) — tune
 * independently if live runs get noisy.
 */
export const AGREED_MIN_CONTAINMENT = 0.6;

/**
 * Every cross-agent pair of findings in a group, as their title-token sets.
 * Same-agent pairs are excluded — two findings from the same agent never
 * form a J pair with each other (AC-35).
 */
function crossAgentTokenPairs(group: LocationGroup): Array<[Set<string>, Set<string>]> {
  const findings = group.findings;
  const pairs: Array<[Set<string>, Set<string>]> = [];
  for (let i = 0; i < findings.length; i++) {
    for (let j = i + 1; j < findings.length; j++) {
      const a = findings[i]!;
      const b = findings[j]!;
      if (a.agentId === b.agentId) continue;
      pairs.push([titleTokens(a.finding.title), titleTokens(b.finding.title)]);
    }
  }
  return pairs;
}

/**
 * Distinct agent ids contributing at least one finding to the group. An
 * agent contributing multiple findings counts once (AC-35) — this is a set
 * of agent ids, not a finding count.
 */
function contributingAgents(group: LocationGroup): Set<string> {
  const agents = new Set<string>();
  for (const af of group.findings as AttributedFinding[]) {
    agents.add(af.agentId);
  }
  return agents;
}

/**
 * Matched: the group has findings from 2+ distinct agents (regardless of
 * title similarity). This is the base "more than one agent flagged this
 * location" state.
 */
export function isMatched(group: LocationGroup): boolean {
  return contributingAgents(group).size >= 2;
}

/**
 * Divergent: 2+ distinct agents AND at least one cross-agent pair has
 * J ≤ DIVERGENT_MAX_J. This is existential over pairs, never an aggregate
 * (e.g. never an average J across the group) — a single low-J pair is
 * enough, even if other pairs in the same group are high-J.
 */
export function isDivergent(group: LocationGroup): boolean {
  if (contributingAgents(group).size < 2) return false;
  return crossAgentTokenPairs(group).some(([a, b]) => jaccard(a, b) <= DIVERGENT_MAX_J);
}

/**
 * Agreed: 2+ distinct agents AND at least one cross-agent pair has
 * J ≥ AGREED_MIN_J **or** containment ≥ AGREED_MIN_CONTAINMENT.
 * Existential over pairs, same as `isDivergent`. A group may satisfy both
 * `isDivergent` and `isAgreed` — this is honest and deliberate (AC-43), do
 * not add a mutual-exclusivity tie-break.
 */
export function isAgreed(group: LocationGroup): boolean {
  if (contributingAgents(group).size < 2) return false;
  return crossAgentTokenPairs(group).some(
    ([a, b]) =>
      jaccard(a, b) >= AGREED_MIN_J || containment(a, b) >= AGREED_MIN_CONTAINMENT,
  );
}
