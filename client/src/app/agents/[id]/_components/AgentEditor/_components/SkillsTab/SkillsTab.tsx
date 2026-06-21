/* SkillsTab — link/unlink + reorder the skills attached to an agent.
   Linked skills come first (in order), then unlinked. Toggling membership or
   dropping a reordered row immediately persists the ordered linked ids via
   useSetAgentSkills. Reorder uses native HTML5 drag (no DnD dep in the repo);
   the pure ordering logic lives in helpers.ts. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { TextInput, Badge } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useSkills, useAgentSkills, useSetAgentSkills } from "../../../../../../../lib/hooks/skills";
import {
  buildRows,
  filterRows,
  linkedIds,
  reorderLinked,
  toggleMembership,
  type SkillRow,
} from "./helpers";
import { TYPE_COLOR } from "./constants";
import { s } from "./styles";

export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const { data: skills } = useSkills();
  const { data: links } = useAgentSkills(agent.id);
  const setAgentSkills = useSetAgentSkills();

  const [rows, setRows] = React.useState<SkillRow[]>([]);
  const [filter, setFilter] = React.useState("");
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);

  // Seed/refresh local order whenever the server data or the agent changes.
  React.useEffect(() => {
    setRows(buildRows(skills ?? [], links ?? []));
  }, [skills, links, agent.id]);

  const persist = (next: SkillRow[]) =>
    setAgentSkills.mutate({ agentId: agent.id, skill_ids: linkedIds(next) });

  const toggle = (skillId: string) => {
    const next = toggleMembership(rows, skillId);
    setRows(next);
    persist(next);
  };

  // Drag handlers operate on positions within the linked sub-list.
  const onDrop = (toLinkedIdx: number) => {
    if (dragFrom == null) return;
    const next = reorderLinked(rows, dragFrom, toLinkedIdx);
    setDragFrom(null);
    if (next === rows) return;
    setRows(next);
    persist(next);
  };

  const visible = filterRows(rows, filter);
  const total = rows.length;
  const linkedCount = rows.filter((r) => r.linked).length;

  // Map each linked row to its index within the linked sub-list for DnD.
  let linkedSeen = -1;

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.titleRow}>
          <h2 style={s.h2}>{t("skills.title")}</h2>
          <span style={s.count}>{t("skills.enabledCount", { linked: linkedCount, total })}</span>
        </div>
        <TextInput value={filter} onChange={setFilter} placeholder={t("skills.filterPlaceholder")} />
        <div style={s.hint}>{t("skills.orderHint")}</div>
      </div>

      <div style={s.list}>
        {visible.length === 0 ? (
          <div style={s.empty}>—</div>
        ) : (
          visible.map((row, idx) => {
            const linkedIdx = row.linked ? ++linkedSeen : -1;
            const draggable = row.linked && !filter.trim();
            return (
              <div
                key={row.skill.id}
                style={{
                  ...s.row,
                  ...(idx === 0 ? s.rowFirst : null),
                  ...(draggable && dragFrom === linkedIdx ? s.rowDragging : null),
                }}
                draggable={draggable}
                onDragStart={() => draggable && setDragFrom(linkedIdx)}
                onDragOver={(e) => {
                  if (draggable) e.preventDefault();
                }}
                onDrop={() => draggable && onDrop(linkedIdx)}
                onDragEnd={() => setDragFrom(null)}
              >
                <span
                  style={{ ...s.handle, ...(draggable ? null : s.handleDisabled) }}
                  aria-hidden
                >
                  ☰
                </span>
                <input
                  type="checkbox"
                  checked={row.linked}
                  onChange={() => toggle(row.skill.id)}
                  style={s.checkbox}
                  aria-label={row.skill.name}
                />
                <span className="mono" style={s.name}>
                  {row.skill.name}
                </span>
                <Badge color={TYPE_COLOR[row.skill.type]}>{row.skill.type}</Badge>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
