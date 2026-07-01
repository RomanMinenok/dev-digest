/* SkillCard — mono name, enabled toggle, type + source badges, agent count.
   Mirrors AgentCard. Stats other than "used by N agents" are omitted (no data). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useUpdateSkill, useDeleteSkill } from "../../../../lib/hooks/skills";
import { typeColor } from "./helpers";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  agentCount,
  onClick,
}: {
  skill: Skill;
  active?: boolean;
  agentCount?: number;
  onClick?: () => void;
}) {
  const t = useTranslations("skills");
  const update = useUpdateSkill();
  const del = useDeleteSkill();
  const color = typeColor(skill.type);
  return (
    <div onClick={onClick} style={s.card(!!active, skill.enabled)}>
      <div style={s.headerRow}>
        <div style={s.iconBox}>
          <Icon.Sparkles size={15} />
        </div>
        <span className="mono" style={s.name}>
          {skill.name}
        </span>
        <div onClick={(e) => e.stopPropagation()}>
          <Toggle
            on={skill.enabled}
            onChange={(enabled) => update.mutate({ id: skill.id, patch: { enabled } })}
            size={14}
          />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete skill "${skill.name}"? This cannot be undone.`)) del.mutate(skill.id);
          }}
          disabled={del.isPending}
          title="Delete skill"
          aria-label="Delete skill"
          style={{
            background: "none",
            border: "none",
            cursor: del.isPending ? "not-allowed" : "pointer",
            color: "var(--text-muted)",
            display: "inline-flex",
            padding: 4,
          }}
        >
          <Icon.Trash size={14} style={del.isPending ? { animation: "ddspin 1s linear infinite" } : undefined} />
        </button>
      </div>
      <div style={s.description}>{skill.description || t("listItem.noDescription")}</div>
      <div style={s.metaRow}>
        <Badge color={color} bg={color + "1a"}>
          {t(`listItem.type.${skill.type}`)}
        </Badge>
        <Badge color="var(--text-secondary)">{t(`listItem.source.${skill.source}`)}</Badge>
      </div>
      {agentCount != null && <div style={s.footer}>{t("listItem.agentCount", { count: agentCount })}</div>}
    </div>
  );
}
