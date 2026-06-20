import type { FindingActionKind } from "@devdigest/shared";

/** Sort weight per severity (lower = shown first). */
export const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  WARNING: 1,
  SUGGESTION: 2,
  INFO: 3,
};

/** Filter chips rendered in the FindingsPanel toolbar. */
export const SEVERITY_FILTERS = [
  { key: "CRITICAL", iconName: "AlertOctagon", color: "var(--crit)" },
  { key: "WARNING", iconName: "AlertTriangle", color: "var(--warn)" },
  { key: "SUGGESTION", iconName: "Lightbulb", color: "var(--sugg)" },
] as const;

/** Confidence below this is hidden when "hide low confidence" is on. */
export const LOW_CONFIDENCE_THRESHOLD = 0.65;

/** Keyboard shortcut → finding action. */
export const KEY_TO_ACTION: Record<string, FindingActionKind> = {
  a: "accept",
  d: "dismiss",
};
