/* MetricBar — a coloured horizontal bar + "NN%" readout for one eval metric.
   Presentational only: no hooks, no data fetching. Reused by both the
   cross-agent run list and the agent screen's Recent Runs table. */

import { EVAL_METRIC_COLORS, type EvalMetricField } from "./constants";
import { fillStyle, s } from "./styles";

export interface MetricBarProps {
  field: EvalMetricField;
  /** 0–1, or null when the metric was never measured. */
  value: number | null;
}

export function MetricBar({ field, value }: MetricBarProps) {
  // "No data" (—) and "scored zero" (0%) must render distinctly — gating on
  // `null` here, never on `value === 0`.
  if (value === null) {
    return <span style={s.unavailable}>—</span>;
  }

  const pct = Math.round(value * 100);
  const color = EVAL_METRIC_COLORS[field];

  return (
    <span style={s.wrap}>
      <span style={s.track}>
        <span style={fillStyle(value, color)} />
      </span>
      <span style={s.label}>{pct}%</span>
    </span>
  );
}
