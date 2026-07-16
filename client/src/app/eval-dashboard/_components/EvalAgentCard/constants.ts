/* Constants for EvalAgentCard. */
import { EVAL_METRIC_COLORS, type EvalMetricField } from "@/lib/eval-metric-colors";

/** Re-exported so the card's readout column doesn't invent its own hex codes —
    shared with MetricBar (T10). */
export { EVAL_METRIC_COLORS };
export type { EvalMetricField };

export const AGENT_CARD_SPARKLINE_WIDTH = 72;
export const AGENT_CARD_SPARKLINE_HEIGHT = 24;

/** Order the three readouts appear in, right-aligned per mock 01. */
export const METRIC_READOUT_FIELDS: readonly EvalMetricField[] = [
  "recall",
  "precision",
  "citation_accuracy",
];
