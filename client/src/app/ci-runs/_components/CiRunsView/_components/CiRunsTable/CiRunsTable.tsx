/* CiRunsTable — presentational CI runs table (mock 06, AC-37).
   Typed props only: parent owns fetch/state; this component renders rows. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon } from "@devdigest/ui";
import type { CiRun } from "@devdigest/shared";
import { formatCost } from "@/components/run-trace-drawer/helpers";
import { COLUMN_LABELS } from "../../constants";
import { formatDurationSeconds, formatRanAt, formatSource } from "../../helpers";
import { GRID_TEMPLATE_COLUMNS, statusVisual } from "./constants";
import { hasArtifact, hasFindingCounts, prLabel } from "./helpers";
import { dataRow, s } from "./styles";

const SEV_ITEMS = [
  { key: "critical" as const, icon: <Icon.AlertOctagon size={12} />, color: "var(--crit)" },
  { key: "warning" as const, icon: <Icon.AlertTriangle size={12} />, color: "var(--warn)" },
  { key: "suggestion" as const, icon: <Icon.Lightbulb size={12} />, color: "var(--sugg)" },
];

export interface CiRunsTableProps {
  runs: CiRun[];
  onOpenTrace: (run: CiRun) => void;
}

function FindingsCell({ run }: { run: CiRun }) {
  if (!hasArtifact(run)) {
    return <span style={s.muted}>—</span>;
  }

  if (!hasFindingCounts(run)) {
    return <span style={s.muted}>—</span>;
  }

  const counts = {
    critical: run.critical ?? 0,
    warning: run.warning ?? 0,
    suggestion: run.suggestion ?? 0,
  };

  if (counts.critical === 0 && counts.warning === 0 && counts.suggestion === 0) {
    return <span style={s.numeric}>0</span>;
  }

  return (
    <div style={s.findings}>
      {SEV_ITEMS.map(({ key, icon, color }) => {
        const n = counts[key];
        if (n === 0) return null;
        return (
          <span key={key} style={{ ...s.findingCount, color }} aria-label={`${key} ${n}`}>
            {icon}
            {n}
          </span>
        );
      })}
    </div>
  );
}

function StatusCell({ status }: { status: string | null }) {
  const t = useTranslations("ci");
  const visual = statusVisual(status);
  const label =
    visual.i18nKey != null ? t(`runs.status.${visual.i18nKey}`) : (status ?? "—");

  return (
    <Badge dot color={visual.color} bg={visual.bg}>
      {label}
    </Badge>
  );
}

function TraceCell({
  run,
  onOpenTrace,
}: {
  run: CiRun;
  onOpenTrace: (run: CiRun) => void;
}) {
  const active = run.run_id != null;

  if (!active) {
    return <span style={s.traceInactive}>{COLUMN_LABELS.trace}</span>;
  }

  return (
    <button
      type="button"
      style={s.traceActive}
      onClick={() => onOpenTrace(run)}
    >
      {COLUMN_LABELS.trace}
    </button>
  );
}

export function CiRunsTable({ runs, onOpenTrace }: CiRunsTableProps) {
  const t = useTranslations("ci");
  const gridStyle = { gridTemplateColumns: GRID_TEMPLATE_COLUMNS };

  return (
    <div style={s.wrap} role="table" aria-label={t("runs.title")}>
      <div role="row" style={{ ...s.headerRow, ...gridStyle }}>
        <span role="columnheader" style={s.headerCell}>
          {t("runs.table.timestamp")}
        </span>
        <span role="columnheader" style={s.headerCell}>
          {t("runs.table.pullRequest")}
        </span>
        <span role="columnheader" style={s.headerCell}>
          {COLUMN_LABELS.agent}
        </span>
        <span role="columnheader" style={s.headerCell}>
          {t("runs.table.source")}
        </span>
        <span role="columnheader" style={s.headerCell}>
          {COLUMN_LABELS.duration}
        </span>
        <span role="columnheader" style={s.headerCell}>
          {t("runs.table.findings")}
        </span>
        <span role="columnheader" style={s.headerCell}>
          {t("runs.table.cost")}
        </span>
        <span role="columnheader" style={s.headerCell}>
          {t("runs.table.status")}
        </span>
        <span role="columnheader" style={s.headerCell} aria-hidden />
      </div>

      {runs.map((run, index) => (
        <div key={run.id} role="row" style={{ ...dataRow(index), ...gridStyle }}>
          <span style={s.muted}>{formatRanAt(run.ran_at)}</span>

          <div style={s.prCell}>
            <span style={s.prNumber}>{prLabel(run)}</span>
            {run.pr_title ? (
              <span style={s.prTitle} title={run.pr_title}>
                {run.pr_title}
              </span>
            ) : null}
          </div>

          <div style={s.agentCell} title={run.agent ?? undefined}>
            <Icon.Boxes size={12} color="var(--text-muted)" />
            <span style={s.agentName}>{run.agent ?? "—"}</span>
          </div>

          <div style={s.sourceCell}>
            <Icon.GitBranch size={12} />
            <span>{formatSource(run.source)}</span>
          </div>

          <span style={hasArtifact(run) ? s.numeric : s.muted}>
            {formatDurationSeconds(run.duration_s)}
          </span>

          <FindingsCell run={run} />

          {hasArtifact(run) ? (
            <span style={run.cost_usd != null ? s.numeric : s.muted}>
              {formatCost(run.cost_usd)}
            </span>
          ) : (
            <span style={s.muted}>—</span>
          )}

          <StatusCell status={run.status} />

          <TraceCell run={run} onOpenTrace={onOpenTrace} />
        </div>
      ))}
    </div>
  );
}
