/* MetricTrend — the agent screen's metric trend chart (mock 02, AC-16/17/18).
   Wraps the shared LineChart with three series (Recall / Precision / Citation)
   built from `dashboard.trend`, which the server already delivers as one point
   per agent version in chronological order — this presenter does not re-sort or
   re-filter. An empty range renders the "no runs in the last {days} days" copy
   rather than an empty chart frame (spec edge case). Presenter only. */

import { useTranslations } from "next-intl";
import { LineChart, type ChartSeries } from "@devdigest/ui";
import type { EvalTrendPoint } from "@devdigest/shared";
import { EVAL_METRIC_COLORS, TREND_SERIES } from "./constants";
import { s, swatchStyle } from "./styles";

export interface MetricTrendProps {
  trend: EvalTrendPoint[];
  /** Active range in days — only used for the empty-state copy. */
  days: number;
}

export function MetricTrend({ trend, days }: MetricTrendProps) {
  const t = useTranslations("eval");

  const series: ChartSeries[] = TREND_SERIES.map(({ field, legendKey }) => ({
    name: t(`dashboard.legend.${legendKey}`),
    color: EVAL_METRIC_COLORS[field],
    data: trend.map((point) => point[field]),
  }));

  return (
    <div style={s.card}>
      <span style={s.heading}>{t("dashboard.metricTrend")}</span>

      {trend.length === 0 ? (
        <div style={s.empty}>{t("agentScreen.emptyRuns", { days })}</div>
      ) : (
        <>
          <LineChart series={series} />
          <div style={s.legend}>
            {TREND_SERIES.map(({ field, legendKey }) => (
              <span key={field} style={s.legendItem}>
                <span style={swatchStyle(EVAL_METRIC_COLORS[field])} />
                {t(`dashboard.legend.${legendKey}`)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
