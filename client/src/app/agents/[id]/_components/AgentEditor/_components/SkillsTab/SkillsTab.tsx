/* SkillsTab — link/unlink + reorder the skills attached to an agent.
   Linked skills come first (in order), then unlinked. Membership toggles and
   reorders edit a LOCAL draft; nothing is persisted until "Save skills" is
   pressed (useSetAgentSkills). This is deliberate: persisting the linked-skill
   set now bumps the agent version server-side, so per-checkbox auto-save would
   churn a new version on every click. Reorder uses native HTML5 drag (no DnD
   dep in the repo); the pure ordering logic lives in helpers.ts. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { TextInput, Badge, Button } from "@devdigest/ui";
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

/** Order-sensitive equality — reordering linked skills is a real change. */
function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const { data: skills } = useSkills();
  const { data: links } = useAgentSkills(agent.id);
  const setAgentSkills = useSetAgentSkills();

  const [rows, setRows] = React.useState<SkillRow[]>([]);
  const [filter, setFilter] = React.useState("");
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);

  // Seed/refresh local order whenever the server data or the agent changes.
  // After a save, the invalidated `links` query refetches and this resets the
  // draft to the persisted set (clearing the dirty state).
  React.useEffect(() => {
    setRows(buildRows(skills ?? [], links ?? []));
  }, [skills, links, agent.id]);

  const toggle = (skillId: string) => {
    setRows((prev) => toggleMembership(prev, skillId));
  };

  // Drag handlers operate on positions within the linked sub-list.
  const onDrop = (toLinkedIdx: number) => {
    if (dragFrom == null) return;
    setDragFrom(null);
    setRows((prev) => reorderLinked(prev, dragFrom, toLinkedIdx));
  };

  const visible = filterRows(rows, filter);
  const total = rows.length;
  const linkedCount = rows.filter((r) => r.linked).length;

  // Dirty = the draft's ordered linked ids differ from what the server holds.
  const savedIds = React.useMemo(
    () => [...(links ?? [])].sort((a, b) => a.order - b.order).map((l) => l.skill_id),
    [links],
  );
  const dirty = !sameIds(linkedIds(rows), savedIds);

  const save = () => {
    if (!dirty || setAgentSkills.isPending) return;
    setAgentSkills.mutate({ agentId: agent.id, skill_ids: linkedIds(rows) });
  };

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
        <div style={s.actions}>
          <Button
            kind="primary"
            icon="Check"
            onClick={save}
            disabled={!dirty || setAgentSkills.isPending}
          >
            {t("skills.save")}
          </Button>
          {dirty && <span style={s.unsaved}>{t("skills.unsaved")}</span>}
        </div>
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
