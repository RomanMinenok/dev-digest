/* Constants for AgentEvalView. */
import { EVAL_METRIC_COLORS, type EvalMetricField } from "@/lib/eval-metric-colors";

/** Re-exported so this view's metric cards don't invent their own hex codes —
    shared with MetricBar (T10) and EvalAgentCard (T13). */
export { EVAL_METRIC_COLORS };
export type { EvalMetricField };

/** Order the three metric cards appear in (AC-11), matching mock 02. */
export const METRIC_CARD_FIELDS: readonly EvalMetricField[] = [
  "recall",
  "precision",
  "citation_accuracy",
];

export const BACK_HREF = "/eval-dashboard";
