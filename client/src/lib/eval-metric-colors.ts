/**
 * Canonical colors for the three eval score metrics.
 * Maps 1:1 onto the design tokens already used in Showcase
 * (recall → accent blue, precision → ok teal, citation → warn amber).
 */
export const EVAL_METRIC_COLORS = {
  recall: "var(--accent)",
  precision: "var(--ok)",
  citation_accuracy: "var(--warn)",
} as const;

export type EvalMetricField = keyof typeof EVAL_METRIC_COLORS;
