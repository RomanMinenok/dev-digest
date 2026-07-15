import type { EvalMetricField } from "@/lib/eval-metric-colors";

/** Metric-bar columns, in mock-02 order: recall · precision · citation. */
export const RECENT_RUNS_METRIC_FIELDS: readonly EvalMetricField[] = [
  "recall",
  "precision",
  "citation_accuracy",
];

/** Exactly two selected version runs are required to enable Compare (AC-23). */
export const COMPARE_SELECTION_SIZE = 2;
