import type { EvalMetricField } from "@/lib/eval-metric-colors";

/** Order the three metric bars appear in — mirrors EvalAgentCard's readout
    order (recall, precision, citation) without reaching into that folder's
    internals (its barrel only re-exports the component, per convention). */
export const RUNS_TABLE_METRIC_FIELDS: readonly EvalMetricField[] = [
  "recall",
  "precision",
  "citation_accuracy",
];
