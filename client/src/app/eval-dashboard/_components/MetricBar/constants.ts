import { EVAL_METRIC_COLORS, type EvalMetricField } from "@/lib/eval-metric-colors";

/** Re-exported for callers that only need the field union, not the color map. */
export type { EvalMetricField };

/** Track width in px — fixed so bars in a table column line up. */
export const METRIC_BAR_TRACK_WIDTH = 56;
export const METRIC_BAR_TRACK_HEIGHT = 6;

export { EVAL_METRIC_COLORS };
