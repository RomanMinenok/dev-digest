/* FindingsByLocation — the "Findings by location" matrix (SPEC-05, T-27 —
   AC-33, AC-36..AC-43). One row per location group, one column per member
   agent in the same order the server sent them (the lanes'/tabs' order,
   AC-33) — rendered as received, never re-sorted or re-grouped per row.
   Each cell is exactly one of four states (severity / did not flag /
   failed / pending). "did not flag" carries no explanatory sentence and
   reserves no space for one (AC-36). The block renders as soon as any
   location groups exist (partial run OK) — in-flight members show
   `pending`, not silence or failure (AC-37 amended 2026-07-17). matched/
   divergent/agreed are read as-is from the server's flags (T-05) — nothing
   here recomputes Jaccard or a similarity threshold. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SeverityBadge } from "@devdigest/ui";
import type { MultiAgentCell, MultiAgentGroup, MultiAgentRunView } from "@devdigest/shared";
import { DEFAULT_FILTER, type LocationFilter as LocationFilterValue } from "./constants";
import { allMembersSettled, cellFinding, filterCounts, filteredGroups, groupKey, memberNamesByKey } from "./helpers";
import { LocationFilter } from "./LocationFilter";
import { s } from "./styles";

export interface FindingsByLocationProps {
  run: MultiAgentRunView;
}

export function FindingsByLocation({ run }: FindingsByLocationProps) {
  const t = useTranslations("multiAgent");
  const [filter, setFilter] = React.useState<LocationFilterValue>(DEFAULT_FILTER);

  // Progressive: show once groups exist. Hide only while still mid-run with
  // nothing to show yet (avoid flashing the empty-run note before first finish).
  if (run.groups.length === 0 && !allMembersSettled(run.members)) return null;

  const removedAgentLabel = t("byLocation.removedAgent");
  const names = memberNamesByKey(run.members, removedAgentLabel);
  const counts = filterCounts(run.groups);
  const shown = filteredGroups(run.groups, filter);

  return (
    <div style={s.root}>
      <div style={s.headerRow}>
        <span style={s.title}>
          <Icon.Boxes size={14} />
          {t("byLocation.title")}
        </span>
        <LocationFilter value={filter} counts={counts} onChange={setFilter} />
      </div>

      {run.groups.length === 0 ? (
        <div style={s.emptyNote}>{t("byLocation.emptyRun")}</div>
      ) : shown.length === 0 ? (
        <div style={s.emptyNote}>{t("byLocation.emptyFilter")}</div>
      ) : (
        <div style={s.list}>
          {shown.map((group) => (
            <LocationGroupRow key={groupKey(group)} group={group} names={names} removedAgentLabel={removedAgentLabel} />
          ))}
        </div>
      )}
    </div>
  );
}

function LocationGroupRow({
  group,
  names,
  removedAgentLabel,
}: {
  group: MultiAgentGroup;
  names: Map<string, string>;
  removedAgentLabel: string;
}) {
  return (
    <div style={s.groupCard}>
      <div style={s.groupHeader}>
        <Icon.Code size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <span style={s.groupLocation}>{`${group.file}:${group.start_line}`}</span>
        <span style={s.groupLabel}>{group.label}</span>
      </div>
      <div style={s.cellRow}>
        {group.cells.map((cell) => (
          <LocationCell
            key={cell.agent_id}
            cell={cell}
            group={group}
            name={names.get(cell.agent_id) ?? removedAgentLabel}
          />
        ))}
      </div>
    </div>
  );
}

function LocationCell({ cell, group, name }: { cell: MultiAgentCell; group: MultiAgentGroup; name: string }) {
  const t = useTranslations("multiAgent");
  // "did not flag" is reused verbatim from the existing "runs" namespace
  // rather than duplicated under a new key.
  const tRuns = useTranslations("runs");
  // Only a `severity` cell gets a title line: "did not flag" is silence, and
  // AC-36 forbids giving that silence a sentence — or space for one.
  const finding = cell.state === "severity" ? cellFinding(group, cell.agent_id, cell.severity) : undefined;
  return (
    <div style={s.cell}>
      <span style={s.cellAgentName}>{name}</span>
      {cell.state === "severity" ? (
        <>
          <SeverityBadge severity={cell.severity} />
          {finding ? <span style={s.cellTitle}>{finding.title}</span> : null}
        </>
      ) : cell.state === "did_not_flag" ? (
        <span style={s.mutedState}>{`● ${tRuns("conflicts.didNotFlag")}`}</span>
      ) : cell.state === "pending" ? (
        <span style={s.mutedState}>{`● ${t("results.running")}`}</span>
      ) : (
        <span style={s.failedState}>{`● ${t("byLocation.failed")}`}</span>
      )}
    </div>
  );
}
