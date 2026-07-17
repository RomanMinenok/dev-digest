/**
 * Pure per-agent estimate + selection totals (SPEC-05, T-07 — AC-9, AC-10, AC-11).
 *
 * No I/O, no framework imports. The repository (T-10) is responsible for the
 * workspace-scoped `WHERE status = 'done' ORDER BY ran_at DESC LIMIT 5` query
 * per agent — this module is pure arithmetic over whatever rows it is handed.
 * Do NOT filter by status or slice to 5 here; do NOT reuse `selectSessionWindow`
 * (that is a different rule — a 60s "same review session" window, not "an
 * agent's own last 5 done runs").
 */

/**
 * One row of history for a single agent's completed run. `cost_usd` is
 * nullable ("unknown price for this model"), NOT zero — see below.
 */
interface AgentRunRow {
  duration_ms: number | null;
  cost_usd: number | null;
}

/**
 * An agent's estimate derived from its recent completed-run history.
 *
 * `duration_ms` / `cost_usd` are `null`, not `0`, whenever there is no valid
 * value to compute a median from — `0` is a legitimate median value and must
 * never share a glyph with "no data" (client renders the distinction).
 */
export interface AgentEstimate {
  duration_ms: number | null;
  cost_usd: number | null;
}

/** Selection-level rollup across multiple agents' estimates. */
export interface EstimateTotals {
  duration_ms: number | null;
  cost_usd: number | null;
  /**
   * `true` ⇒ render with `≈` (every checked agent had at least one row of
   * history). `false` ⇒ render with `≥` (at least one checked agent had zero
   * rows, i.e. no completed-run history at all — AC-11). This is data, not a
   * UI re-derivation: the UI must consume it as-is.
   */
  approx: boolean;
}

/**
 * Median of ascending-sorted values: odd count ⇒ middle, even count ⇒ mean of
 * the two middles. Returns `null` for an empty input.
 */
function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Estimate one agent from its own recent completed-run rows.
 *
 * Duration and cost medians are computed **independently** — they need not
 * come from the same run. `cost_usd` nulls are excluded from the cost median
 * rather than coerced to `0` (a run with a duration but unknown price still
 * contributes its duration). If every row has a null cost but valid
 * durations, the agent still has history: this returns a real `duration_ms`
 * median and a `null` `cost_usd` — that is NOT the "no history yet" case,
 * which only fires on zero rows (enforced by the caller/repository, since a
 * zero-row result here means the repository found no `done` runs for this
 * agent at all).
 */
export function estimateForAgent(rows: AgentRunRow[]): AgentEstimate {
  if (rows.length === 0) {
    return { duration_ms: null, cost_usd: null };
  }

  const durations = rows
    .map((r) => r.duration_ms)
    .filter((v): v is number => v !== null);
  const costs = rows
    .map((r) => r.cost_usd)
    .filter((v): v is number => v !== null);

  return {
    duration_ms: median(durations),
    cost_usd: median(costs),
  };
}

/**
 * Roll up a selection's per-agent estimates into a single total.
 *
 * - `duration_ms` — **max** across estimates (the runs fan out in parallel;
 *   the selection takes as long as its slowest member).
 * - `cost_usd` — **sum** across estimates (every member is paid for).
 * - Agents with no estimate (zero completed-run history) are excluded from
 *   BOTH totals and flip `approx` to `false` (AC-11's "no completed run
 *   history" case, literally). Agents that merely have a `null` cost (all-null
 *   cost history but a real duration) still contribute their duration to the
 *   max and are NOT the "no history" case — only a wholly-null estimate
 *   (`duration_ms === null && cost_usd === null`, i.e. zero rows) triggers
 *   the `approx: false` flip.
 *
 * T-14 will mirror this max/sum rule in a client helper — keep this simple
 * enough to copy exactly.
 */
export function estimateTotals(estimates: AgentEstimate[]): EstimateTotals {
  let approx = true;
  const durations: number[] = [];
  const costs: number[] = [];

  for (const estimate of estimates) {
    const hasNoHistory = estimate.duration_ms === null && estimate.cost_usd === null;
    if (hasNoHistory) {
      approx = false;
      continue;
    }
    if (estimate.duration_ms !== null) {
      durations.push(estimate.duration_ms);
    }
    if (estimate.cost_usd !== null) {
      costs.push(estimate.cost_usd);
    }
  }

  return {
    duration_ms: durations.length > 0 ? Math.max(...durations) : null,
    cost_usd: costs.length > 0 ? costs.reduce((sum, c) => sum + c, 0) : null,
    approx,
  };
}
