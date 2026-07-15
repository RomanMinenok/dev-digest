/* RunsTable — "RECENT EVAL RUNS · ALL AGENTS" cross-agent run list (mock 01),
   plus the COST column (deliberate spec deviation, AC-8). The server already
   sorts `version_runs` newest-first (AC-9) — this component does not re-sort.
   Presenter only: no fetching, no mutation. */

import { useTranslations } from "next-intl";
import type { EvalVersionRun } from "@devdigest/shared";
import { MetricBar } from "../../../MetricBar";
import { VersionChip } from "../../../VersionChip";
import { PassCell, CostCell } from "../../../RunCells";
import { RUNS_TABLE_METRIC_FIELDS } from "./constants";
import { formatRanAt } from "./helpers";
import { row, s } from "./styles";

export interface RunsTableProps {
  runs: EvalVersionRun[];
  days: number;
}

export function RunsTable({ runs, days }: RunsTableProps) {
  const t = useTranslations("eval");

  if (runs.length === 0) {
    return <div style={s.empty}>{t("overviewPage.emptyRuns", { days })}</div>;
  }

  return (
    <div style={s.table} role="table" aria-label={t("overviewPage.recentRunsHeading")}>
      {runs.map((run, i) => (
        // Version runs have no stable id in the contract — agent + version + ran_at
        // together are unique per row on this cross-agent list.
        <div key={`${run.agent_id}-${run.agent_version}-${run.ran_at}`} role="row" style={row(i)}>
          <span style={s.agentName}>{run.agent_name}</span>
          <span style={s.ranAt}>{formatRanAt(run.ran_at)}</span>
          <VersionChip version={run.agent_version} />
          {RUNS_TABLE_METRIC_FIELDS.map((field) => (
            <MetricBar key={field} field={field} value={run[field]} />
          ))}
          <PassCell passed={run.cases_passed} total={run.cases_total} />
          <CostCell costUsd={run.cost_usd} />
        </div>
      ))}
    </div>
  );
}
