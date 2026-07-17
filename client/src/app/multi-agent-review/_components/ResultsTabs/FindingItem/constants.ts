/** Severity → CSS colour token, mirroring FindingCard's constants. */
export const SEV_COLOR: Record<string, string> = {
  CRITICAL: "var(--crit)",
  WARNING: "var(--warn)",
  SUGGESTION: "var(--sugg)",
  INFO: "var(--info)",
};

/** Fallback colour for an unknown severity. */
export const SEV_COLOR_FALLBACK = "var(--text-muted)";
