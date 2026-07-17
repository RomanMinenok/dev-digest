import { describe, it, expect } from 'vitest';
import type { Finding } from '@devdigest/shared';
import type { AttributedFinding, LocationGroup } from './types.js';
import {
  titleTokens,
  jaccard,
  containment,
  isMatched,
  isDivergent,
  isAgreed,
  DIVERGENT_MAX_J,
  AGREED_MIN_J,
  AGREED_MIN_CONTAINMENT,
} from './similarity.js';

/**
 * Titles are chosen so the cross-agent Jaccard / containment lands on an
 * exact, hand-checked value — the thresholds are `<=` / `>=`, so the
 * boundary itself is the interesting case, not a value near it.
 */
const finding = (id: string, title: string): Finding => ({
  id,
  severity: 'WARNING',
  category: 'bug',
  title,
  file: 'src/a.ts',
  start_line: 10,
  end_line: 10,
  rationale: 'because',
  confidence: 0.9,
});

const attributed = (id: string, title: string, agentId: string): AttributedFinding => ({
  finding: finding(id, title),
  agentId,
  runId: `run-${id}`,
});

const group = (findings: AttributedFinding[]): LocationGroup => ({
  file: 'src/a.ts',
  minStartLine: 10,
  minEndLine: 10,
  findings,
});

describe('titleTokens', () => {
  it('case-folds and strips punctuation into a set', () => {
    expect(titleTokens('Dialog: close() NOT called!')).toEqual(
      new Set(['dialog', 'close', 'not', 'called']),
    );
  });

  it('de-duplicates repeated words (it is a set, not a bag)', () => {
    expect(titleTokens('bug bug bug')).toEqual(new Set(['bug']));
  });
});

describe('jaccard', () => {
  it('is 1 for identical token sets', () => {
    expect(jaccard(titleTokens('a b c'), titleTokens('a b c'))).toBe(1);
  });

  it('is 0 for disjoint token sets', () => {
    expect(jaccard(titleTokens('a b'), titleTokens('c d'))).toBe(0);
  });

  // Explicit contract: two empty titles are NOT a perfect match.
  it('is 0 — not 1 — when both sets are empty', () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it('is symmetric', () => {
    const a = titleTokens('alpha beta gamma');
    const b = titleTokens('alpha beta delta epsilon');
    expect(jaccard(a, b)).toBe(jaccard(b, a));
  });
});

describe('containment', () => {
  it('is 1 when the shorter set is fully embedded in the longer', () => {
    expect(containment(titleTokens('a b'), titleTokens('a b c d'))).toBe(1);
  });

  it('is 0 for disjoint token sets', () => {
    expect(containment(titleTokens('a b'), titleTokens('c d'))).toBe(0);
  });

  it('is 0 when either set is empty', () => {
    expect(containment(new Set(), titleTokens('a'))).toBe(0);
    expect(containment(titleTokens('a'), new Set())).toBe(0);
  });

  it('is symmetric', () => {
    const a = titleTokens('alpha beta');
    const b = titleTokens('alpha beta gamma');
    expect(containment(a, b)).toBe(containment(b, a));
  });
});

describe('isMatched', () => {
  // AC-40 — |F| >= 2 distinct agents, regardless of title similarity.
  it('is true for findings from two distinct agents', () => {
    expect(
      isMatched(group([attributed('1', 'alpha', 'agent-a'), attributed('2', 'beta', 'agent-b')])),
    ).toBe(true);
  });

  it('is false for a single finding', () => {
    expect(isMatched(group([attributed('1', 'alpha', 'agent-a')]))).toBe(false);
  });

  // AC-35 — one agent contributing two findings counts once.
  it('is false when both findings come from the same agent', () => {
    expect(
      isMatched(group([attributed('1', 'alpha', 'agent-a'), attributed('2', 'beta', 'agent-a')])),
    ).toBe(false);
  });
});

describe('isDivergent', () => {
  // AC-41 — the comparison is `<=`, so J exactly at the threshold IS divergent.
  it(`is true when a cross-agent pair sits exactly on J = ${DIVERGENT_MAX_J}`, () => {
    // 3 shared / 10 union = 0.3
    const a = attributed('1', 'alpha beta gamma delta epsilon zeta', 'agent-a');
    const b = attributed('2', 'alpha beta gamma eta theta iota kappa', 'agent-b');
    expect(jaccard(titleTokens(a.finding.title), titleTokens(b.finding.title))).toBeCloseTo(0.3, 10);
    expect(isDivergent(group([a, b]))).toBe(true);
  });

  it('is false when the only cross-agent pair sits just above the threshold', () => {
    // 1 shared / 3 union = 0.333… > 0.3
    const a = attributed('1', 'alpha beta', 'agent-a');
    const b = attributed('2', 'alpha gamma', 'agent-b');
    expect(jaccard(titleTokens(a.finding.title), titleTokens(b.finding.title))).toBeGreaterThan(
      DIVERGENT_MAX_J,
    );
    expect(isDivergent(group([a, b]))).toBe(false);
  });

  // AC-35 — same-agent pairs never form a pair, however dissimilar.
  it('ignores same-agent pairs entirely', () => {
    const g = group([
      attributed('1', 'alpha beta gamma', 'agent-a'),
      attributed('2', 'nothing in common here', 'agent-a'),
    ]);
    expect(isDivergent(g)).toBe(false);
  });
});

describe('isAgreed', () => {
  // AC-42 — the comparison is `>=`, so J exactly at the threshold IS agreed.
  it(`is true when a cross-agent pair sits exactly on J = ${AGREED_MIN_J}`, () => {
    // 3 shared / 5 union = 0.6
    const a = attributed('1', 'alpha beta gamma', 'agent-a');
    const b = attributed('2', 'alpha beta gamma delta epsilon', 'agent-b');
    expect(jaccard(titleTokens(a.finding.title), titleTokens(b.finding.title))).toBeCloseTo(0.6, 10);
    expect(isAgreed(group([a, b]))).toBe(true);
  });

  it(`is true when containment sits exactly on ${AGREED_MIN_CONTAINMENT} even if J is below`, () => {
    // 3 shared / 5 min = 0.6 containment; 3 / 9 union = 0.333… Jaccard
    const a = attributed('1', 'alpha beta gamma delta epsilon', 'agent-a');
    const b = attributed('2', 'alpha beta gamma zeta eta theta iota', 'agent-b');
    const ta = titleTokens(a.finding.title);
    const tb = titleTokens(b.finding.title);
    expect(containment(ta, tb)).toBeCloseTo(0.6, 10);
    expect(jaccard(ta, tb)).toBeLessThan(AGREED_MIN_J);
    expect(isAgreed(group([a, b]))).toBe(true);
  });

  it('is true when a short title is fully contained in a longer one (live Hardcoded API Key shape)', () => {
    const short = attributed('1', 'Hardcoded API Key', 'security');
    const long = attributed(
      '2',
      'Hardcoded OpenRouter API key fallback in container.ts',
      'shrek',
    );
    const ta = titleTokens(short.finding.title);
    const tb = titleTokens(long.finding.title);
    expect(containment(ta, tb)).toBe(1);
    expect(jaccard(ta, tb)).toBeLessThan(AGREED_MIN_J);
    expect(isAgreed(group([short, long]))).toBe(true);
  });

  it('is false when both Jaccard and containment sit below their thresholds', () => {
    // 4 shared / 11 union ≈ 0.364 J; 4 / 7 min ≈ 0.571 containment
    const a = attributed(
      '1',
      'alpha beta gamma delta epsilon zeta eta',
      'agent-a',
    );
    const b = attributed(
      '2',
      'alpha beta gamma delta theta iota kappa lambda',
      'agent-b',
    );
    const ta = titleTokens(a.finding.title);
    const tb = titleTokens(b.finding.title);
    expect(jaccard(ta, tb)).toBeLessThan(AGREED_MIN_J);
    expect(jaccard(ta, tb)).toBeGreaterThan(DIVERGENT_MAX_J);
    expect(containment(ta, tb)).toBeLessThan(AGREED_MIN_CONTAINMENT);
    expect(isAgreed(group([a, b]))).toBe(false);
  });
});

describe('the soft band — Matched only', () => {
  // Neither Jaccard nor containment clears Agreed; J is also above Divergent.
  it('is Matched but neither Divergent nor Agreed', () => {
    const g = group([
      attributed('1', 'alpha beta gamma delta epsilon zeta eta', 'agent-a'),
      attributed('2', 'alpha beta gamma delta theta iota kappa lambda', 'agent-b'),
    ]);
    expect(isMatched(g)).toBe(true);
    expect(isDivergent(g)).toBe(false);
    expect(isAgreed(g)).toBe(false);
  });
});

describe('AC-43 — Divergent and Agreed are existential over pairs, not exclusive', () => {
  it('reports a group under BOTH filters when its pairs span both thresholds', () => {
    // agent-a contributes two findings; cross-agent pairs are:
    //   f1 vs f3 -> J = 1    (>= 0.6, agreed)
    //   f2 vs f3 -> J = 0    (<= 0.3, divergent)
    // The same-agent pair f1 vs f2 is excluded.
    const g = group([
      attributed('1', 'alpha beta gamma', 'agent-a'),
      attributed('2', 'entirely different wording', 'agent-a'),
      attributed('3', 'alpha beta gamma', 'agent-b'),
    ]);
    expect(isMatched(g)).toBe(true);
    expect(isDivergent(g)).toBe(true);
    expect(isAgreed(g)).toBe(true);
  });
});
