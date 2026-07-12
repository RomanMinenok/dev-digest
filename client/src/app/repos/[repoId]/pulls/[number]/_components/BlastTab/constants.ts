import type { BlastStatus } from "@devdigest/shared";

/** Status badge label + colour token, keyed by the honest index-state badge. */
export const STATUS_LABEL: Record<BlastStatus, string> = {
  full: "Full index",
  partial: "Partial index",
  degraded: "Degraded",
};

export const STATUS_COLOR: Record<BlastStatus, string> = {
  full: "var(--ok)",
  partial: "var(--warn)",
  degraded: "var(--crit)",
};

export const ENDPOINT_COLOR = "var(--info)";
export const CRON_COLOR = "var(--warn)";
