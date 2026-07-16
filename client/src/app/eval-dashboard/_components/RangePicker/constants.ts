/** Supported eval-dashboard lookback windows (AC-19: defaults to 30). */
export type EvalRangeDays = 7 | 30 | 90;

export const EVAL_RANGE_DAYS_DEFAULT: EvalRangeDays = 30;

/** Ordered list of selectable ranges + their i18n key under `eval.agentScreen.range`. */
export const EVAL_RANGE_OPTIONS: { value: EvalRangeDays; labelKey: "d7" | "d30" | "d90" }[] = [
  { value: 7, labelKey: "d7" },
  { value: 30, labelKey: "d30" },
  { value: 90, labelKey: "d90" },
];
