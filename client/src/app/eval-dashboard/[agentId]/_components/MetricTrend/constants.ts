import { EVAL_METRIC_COLORS, type EvalMetricField } from "@/lib/eval-metric-colors";

export { EVAL_METRIC_COLORS };

/** The three trend series, in legend order. `legendKey` indexes the
    `eval.dashboard.legend.*` i18n namespace; `field` reads the metric off each
    `EvalTrendPoint`. */
export const TREND_SERIES: readonly {
  field: Extract<EvalMetricField, "recall" | "precision" | "citation_accuracy">;
  legendKey: "recall" | "precision" | "citation";
}[] = [
  { field: "recall", legendKey: "recall" },
  { field: "precision", legendKey: "precision" },
  { field: "citation_accuracy", legendKey: "citation" },
];
