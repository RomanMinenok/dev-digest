import { EVAL_METRIC_COLORS } from "@/lib/eval-metric-colors";

/** The four old→new delta cards (AC-24), in mock-02 order. Metric fields read a
    0–1 ratio off each `EvalVersionRun`; the cost card is special-cased (currency,
    nullable, "lower is better"). `goodDirection` decides the delta chip colour:
    a rising metric is good, a rising cost is not. */
export type CompareCardField = "recall" | "precision" | "citation_accuracy" | "cost_usd";

export const COMPARE_CARDS: readonly {
  field: CompareCardField;
  labelKey: "recall" | "precision" | "citationAccuracy" | "cost";
  goodDirection: "up" | "down";
  color: string;
}[] = [
  { field: "recall", labelKey: "recall", goodDirection: "up", color: EVAL_METRIC_COLORS.recall },
  { field: "precision", labelKey: "precision", goodDirection: "up", color: EVAL_METRIC_COLORS.precision },
  {
    field: "citation_accuracy",
    labelKey: "citationAccuracy",
    goodDirection: "up",
    color: EVAL_METRIC_COLORS.citation_accuracy,
  },
  { field: "cost_usd", labelKey: "cost", goodDirection: "down", color: "var(--text-secondary)" },
];
