/* SkillEditor — header (icon + name + type/version badges + stub "Run on evals")
   over a 5-tab body (Config · Preview · Evals · Stats · Versions). The active
   tab is driven by the parent (?tab=). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Tabs, Badge, Button, Icon } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { typeColor } from "../SkillCard/helpers";
import { ConfigTab } from "./_components/ConfigTab";
import { ContextSection } from "./_components/ContextSection";
import { PreviewTab } from "./_components/PreviewTab";
import { EvalsTab } from "./_components/EvalsTab";
import { StatsTab } from "./_components/StatsTab";
import { VersionsTab } from "./_components/VersionsTab";
import { TABS } from "./constants";
import { s } from "./styles";

export function SkillEditor({
  skill,
  tab,
  onTab,
}: {
  skill: Skill;
  tab: string;
  onTab: (t: string) => void;
}) {
  const t = useTranslations("skills");
  const tabs = TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));
  const color = typeColor(skill.type);

  return (
    <>
      <div style={s.header}>
        <Icon.Sparkles size={18} style={s.icon} />
        <h1 className="mono" style={s.name}>
          {skill.name}
        </h1>
        <Badge color={color} bg={color + "1a"}>
          {t(`listItem.type.${skill.type}`)}
        </Badge>
        <Badge color="var(--text-secondary)" mono>
          {t("preview.version", { version: skill.version })}
        </Badge>
        <div style={s.spacer} title={t("editor.runOnEvalsTooltip")}>
          <Button kind="secondary" size="sm" icon="FlaskConical" disabled>
            {t("editor.runOnEvals")}
          </Button>
        </div>
      </div>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      <div style={s.body}>
        {tab === "config" && (
          <>
            <ConfigTab skill={skill} />
            <ContextSection skill={skill} />
          </>
        )}
        {tab === "preview" && <PreviewTab skill={skill} />}
        {tab === "evals" && <EvalsTab />}
        {tab === "stats" && <StatsTab skill={skill} />}
        {tab === "versions" && <VersionsTab skill={skill} />}
      </div>
    </>
  );
}
