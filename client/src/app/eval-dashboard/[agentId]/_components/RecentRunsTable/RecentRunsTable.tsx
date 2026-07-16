/* RecentRunsTable — the agent screen's "Recent runs" list with row selection
   (mock 02, AC-8/10/23). Rows come from `dashboard.version_runs`, already
   range-filtered and newest-first server-side — this component never re-sorts or
   re-filters. Each row is a distinct agent version (the list is unique by
   version, AC-23), so ticking two rows always selects two different versions and
   no same-version guard is needed. Compare is enabled iff exactly two rows are
   selected; clicking it hands the two selected version runs up to the parent,
   which opens the Compare modal (T20).

   Selection state is owned here and pruned when the underlying run list changes
   (e.g. the range switches) so a stale version can't stay "selected". */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Checkbox } from "@devdigest/ui";
import type { EvalVersionRun } from "@devdigest/shared";
import { MetricBar } from "../../../_components/MetricBar";
import { VersionChip } from "../../../_components/VersionChip";
import { PassCell, CostCell } from "../../../_components/RunCells";
import { COMPARE_SELECTION_SIZE, RECENT_RUNS_METRIC_FIELDS } from "./constants";
import { formatRanAt } from "./helpers";
import { row, s } from "./styles";

export interface RecentRunsTableProps {
  runs: EvalVersionRun[];
  days: number;
  /** Called with the two selected version runs when Compare is clicked (AC-23). */
  onCompare: (pair: [EvalVersionRun, EvalVersionRun]) => void;
}

export function RecentRunsTable({ runs, days, onCompare }: RecentRunsTableProps) {
  const t = useTranslations("eval");
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  // Prune selections that no longer exist in the current run list — a range
  // change swaps `runs`, and a version that dropped out must not stay ticked.
  const availableVersions = React.useMemo(
    () => new Set(runs.map((r) => r.agent_version)),
    [runs]
  );
  React.useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((v) => availableVersions.has(v)));
      return next.size === prev.size ? prev : next;
    });
  }, [availableVersions]);

  const toggle = (version: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  const canCompare = selected.size === COMPARE_SELECTION_SIZE;

  const handleCompare = () => {
    if (!canCompare) return;
    const [a, b] = runs.filter((r) => selected.has(r.agent_version));
    if (a && b) onCompare([a, b]);
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.heading}>{t("dashboard.recentRuns")}</span>
        <div style={s.headerActions}>
          {selected.size > 0 && (
            <span style={s.selectedCount}>
              {t("agentScreen.selectedCount", { count: selected.size })}
            </span>
          )}
          <Button kind="ghost" icon="Layers" disabled={!canCompare} onClick={handleCompare}>
            {t("agentScreen.compare")}
          </Button>
        </div>
      </div>

      {runs.length === 0 ? (
        <div style={s.empty}>{t("agentScreen.emptyRuns", { days })}</div>
      ) : (
        <div style={s.table} role="table" aria-label={t("dashboard.recentRuns")}>
          {runs.map((run, i) => {
            const isSelected = selected.has(run.agent_version);
            return (
              <div key={run.agent_version} role="row" style={row(i, isSelected)}>
                <Checkbox checked={isSelected} onChange={() => toggle(run.agent_version)} />
                <span style={s.ranAt}>{formatRanAt(run.ran_at)}</span>
                <VersionChip version={run.agent_version} />
                {RECENT_RUNS_METRIC_FIELDS.map((field) => (
                  <MetricBar key={field} field={field} value={run[field]} />
                ))}
                <PassCell passed={run.cases_passed} total={run.cases_total} />
                <CostCell costUsd={run.cost_usd} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
