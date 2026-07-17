import { describe, it, expect } from 'vitest';
import { estimateForAgent, estimateTotals } from './estimate.js';

const row = (duration_ms: number | null, cost_usd: number | null) => ({ duration_ms, cost_usd });

describe('estimateForAgent', () => {
  // AC-9 — median over the rows the repository hands us.
  it('takes the middle value for an odd count', () => {
    const e = estimateForAgent([row(30, 3), row(10, 1), row(20, 2)]);
    expect(e).toEqual({ duration_ms: 20, cost_usd: 2 });
  });

  it('averages the two middles for an even count', () => {
    const e = estimateForAgent([row(10, 1), row(20, 2), row(30, 3), row(40, 4)]);
    expect(e).toEqual({ duration_ms: 25, cost_usd: 2.5 });
  });

  it('is unaffected by input order', () => {
    const ascending = estimateForAgent([row(10, 1), row(20, 2), row(30, 3)]);
    const shuffled = estimateForAgent([row(30, 3), row(10, 1), row(20, 2)]);
    expect(shuffled).toEqual(ascending);
  });

  it('medians over whatever exists when there are fewer than 5 rows', () => {
    expect(estimateForAgent([row(42, 7)])).toEqual({ duration_ms: 42, cost_usd: 7 });
  });

  // AC-11 — zero rows is the "no history yet" case: null, never 0.
  it('returns null — not 0 — for zero rows', () => {
    expect(estimateForAgent([])).toEqual({ duration_ms: null, cost_usd: null });
  });

  // A null cost is "unknown price", not "free".
  it('excludes null costs from the cost median instead of coercing them to 0', () => {
    const e = estimateForAgent([row(10, null), row(20, 4), row(30, 6)]);
    expect(e.cost_usd).toBe(5); // mean of 4 and 6 — the null row does not drag it down
    expect(e.duration_ms).toBe(20); // but that row still contributes its duration
  });

  it('keeps a real duration median when every cost is unknown', () => {
    const e = estimateForAgent([row(10, null), row(30, null)]);
    expect(e).toEqual({ duration_ms: 20, cost_usd: null });
  });

  it('computes the duration and cost medians independently', () => {
    // The middle duration and the middle cost come from different rows.
    const e = estimateForAgent([row(100, 1), row(1, 100), row(50, 50)]);
    expect(e).toEqual({ duration_ms: 50, cost_usd: 50 });
  });

  // 0 is a legitimate median, and must not read as "no data".
  it('treats a genuine 0 as a value, not as missing history', () => {
    expect(estimateForAgent([row(0, 0)])).toEqual({ duration_ms: 0, cost_usd: 0 });
  });
});

describe('estimateTotals', () => {
  // AC-10 — the runs fan out in parallel, so duration is max, cost is sum.
  it('takes the max duration and the sum of costs', () => {
    const t = estimateTotals([
      { duration_ms: 5_000, cost_usd: 0.001 },
      { duration_ms: 70_000, cost_usd: 0.002 },
    ]);
    expect(t.duration_ms).toBe(70_000);
    expect(t.cost_usd).toBeCloseTo(0.003, 10);
  });

  it('is approx when every agent has history', () => {
    const t = estimateTotals([{ duration_ms: 10, cost_usd: 1 }]);
    expect(t.approx).toBe(true);
  });

  // AC-11 — a no-history agent is excluded from both totals and flips the
  // prefix from `≈` to `≥`. The flip is data, not a UI re-derivation.
  it('excludes a no-history agent from both totals and flips approx to false', () => {
    const t = estimateTotals([
      { duration_ms: 10, cost_usd: 1 },
      { duration_ms: null, cost_usd: null },
    ]);
    expect(t.duration_ms).toBe(10);
    expect(t.cost_usd).toBe(1);
    expect(t.approx).toBe(false);
  });

  // An unknown *price* is not the same as no history — the duration still counts.
  it('keeps approx true for an agent with a duration but a null cost', () => {
    const t = estimateTotals([
      { duration_ms: 10, cost_usd: 1 },
      { duration_ms: 99, cost_usd: null },
    ]);
    expect(t.duration_ms).toBe(99);
    expect(t.cost_usd).toBe(1);
    expect(t.approx).toBe(true);
  });

  it('returns nulls for an empty selection', () => {
    expect(estimateTotals([])).toEqual({ duration_ms: null, cost_usd: null, approx: true });
  });
});
