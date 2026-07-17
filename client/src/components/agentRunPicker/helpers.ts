/** Pure helpers for AgentRunPicker (SPEC-05, T-21 — AC-10, AC-11).
    `estimateTotals` is the client-side twin of the server's
    `modules/multi-agent/estimate.ts` (max duration / sum cost); keep the two
    in lockstep if either changes. No React imports here, so the "no history
    yet" copy (T-28, `messages/en/multiAgent.json` "picker.noHistory") is
    passed in by the caller rather than looked up with `useTranslations`. */
import type { AgentEstimate } from "@devdigest/shared";
import { COST_FORMAT_DIGITS } from "./constants";

/** Selection-level rollup across multiple agents' estimates. */
export interface EstimateTotals {
  duration_ms: number | null;
  cost_usd: number | null;
  /** `true` ⇒ render with `≈` (every checked agent had history). `false` ⇒
      render with `≥` (at least one checked agent had zero completed-run
      history) — data, not a UI re-derivation (AC-11). */
  approx: boolean;
}

/**
 * Roll up a selection's per-agent estimates into a single total.
 * - `duration_ms` — max across estimates (the runs fan out in parallel).
 * - `cost_usd` — sum across estimates (every member is paid for).
 * - An agent with a wholly-null estimate (no completed-run history at all)
 *   is excluded from BOTH totals and flips `approx` to `false`. An agent
 *   with a real duration but unknown (`null`) cost still contributes its
 *   duration to the max and is NOT the "no history" case.
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

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(COST_FORMAT_DIGITS).replace(/0+$/, "").replace(/\.$/, "")}`;
}

/**
 * Per-agent row hint (AC-1). Renders `noHistoryLabel` only for a wholly-null
 * estimate (zero completed runs) — a real duration with an unknown-price run
 * still renders its duration, never `0s · $0.00`.
 */
export function agentHint(estimate: AgentEstimate | undefined, noHistoryLabel: string): string {
  if (!estimate || (estimate.duration_ms === null && estimate.cost_usd === null)) {
    return noHistoryLabel;
  }
  const duration = estimate.duration_ms === null ? "—" : formatSeconds(estimate.duration_ms);
  const cost = estimate.cost_usd === null ? "—" : formatCost(estimate.cost_usd);
  return `${duration} · ${cost}`;
}

/** Selection totals line, `≈`/`≥`-prefixed per AC-11. Empty string when the
    selection has nothing to show (no checked agents with any data at all).
    The trailing `fanOutLabel` segment is AC-10's literal presentation: it is
    what tells the reader the duration is a max, not a sum. */
export function totalsLabel(totals: EstimateTotals, fanOutLabel: string): string {
  if (totals.duration_ms === null && totals.cost_usd === null) {
    return "";
  }
  const prefix = totals.approx ? "≈" : "≥";
  const duration = totals.duration_ms === null ? "—" : formatSeconds(totals.duration_ms);
  const cost = totals.cost_usd === null ? "—" : formatCost(totals.cost_usd);
  return `${prefix} ${duration} · ${cost} · ${fanOutLabel}`;
}
