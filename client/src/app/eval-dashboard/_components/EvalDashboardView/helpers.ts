/* Pure helpers for EvalDashboardView — no React imports. */

import { EVAL_RANGE_DAYS_DEFAULT, EVAL_RANGE_OPTIONS, type EvalRangeDays } from "../RangePicker";
import { DAYS_PARAM } from "./constants";
import type { EvalAgentSummary } from "@devdigest/shared";

/** Parse the `days` search param, falling back to the default for anything
    missing or not one of the three supported values. */
export function parseDaysParam(raw: string | null): EvalRangeDays {
  const parsed = Number(raw);
  const match = EVAL_RANGE_OPTIONS.find((option) => option.value === parsed);
  return match ? match.value : EVAL_RANGE_DAYS_DEFAULT;
}

/** Build the next `?days=` query string, preserving other existing params. */
export function buildDaysSearch(current: URLSearchParams, days: EvalRangeDays): string {
  const next = new URLSearchParams(current.toString());
  next.set(DAYS_PARAM, String(days));
  return next.toString();
}

/** AC-39: "Run all agents" is disabled while no listed agent has any eval case. */
export function hasAnyEvalCase(agents: EvalAgentSummary[]): boolean {
  return agents.some((agent) => agent.cases_total > 0);
}
