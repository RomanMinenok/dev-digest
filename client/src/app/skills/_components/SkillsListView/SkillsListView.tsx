/* /skills — Skills Lab master-detail. Left ~360px list (Add Skill dropdown +
   search + SkillCard list); right SkillEditor or a "select a skill" empty state.
   Tab state lives in ?tab=. Mirrors the agents editor two-column shell. */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Skeleton, Icon } from "@devdigest/ui";
import { AppShell } from "../../../../components/app-shell";
import { useSkills, useSkill } from "../../../../lib/hooks/skills";
import { SkillCard } from "../SkillCard";
import { SkillEditor } from "../SkillEditor";
import { CreateSkillModal } from "../CreateSkillModal";
import { ImportSkillDrawer } from "../ImportSkillDrawer";
import { DEFAULT_TAB } from "./constants";
import { filterSkills, resolveTab } from "./helpers";
import { s } from "./styles";

export function SkillsListView({ selectedId }: { selectedId?: string }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const search = useSearchParams();
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const { data: selected, isLoading: detailLoading } = useSkill(selectedId);

  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  const tab = resolveTab(search.get("tab"));
  const setTab = (next: string) => {
    if (!selectedId) return;
    const sp = new URLSearchParams(search.toString());
    sp.set("tab", next);
    router.replace(`/skills/${selectedId}?${sp.toString()}`);
  };

  const list = filterSkills(skills ?? [], query);
  const crumb = [{ label: t("page.crumbLab") }, { label: t("page.crumbSkills"), href: "/skills" }];

  return (
    <AppShell crumb={crumb}>
      {creating && <CreateSkillModal onClose={() => setCreating(false)} />}
      {importing && <ImportSkillDrawer onClose={() => setImporting(false)} />}
      <div style={s.shell}>
        {/* left: skill list */}
        <div style={s.list}>
          <div style={s.listHead}>
            <div style={s.titleRow}>
              <h1 style={s.h1}>{t("page.heading")}</h1>
              <Dropdown
                width={210}
                align="right"
                trigger={
                  <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                    {t("page.addSkill")}
                  </Button>
                }
                items={[
                  { label: t("page.menu.fromScratch"), icon: "Edit", onClick: () => setCreating(true) },
                  { divider: true },
                  { label: t("page.menu.fromFile"), icon: "Upload", onClick: () => setImporting(true) },
                ]}
              />
            </div>
            <div style={s.search}>
              <Icon.Search size={13} style={s.searchIcon} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("page.searchPlaceholder")}
                style={s.searchInput}
              />
            </div>
          </div>
          <div style={s.listBody}>
            {isLoading && (
              <div style={s.loading}>
                <Skeleton height={92} />
                <Skeleton height={92} />
                <Skeleton height={92} />
              </div>
            )}
            {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
            {!isLoading && !isError && list.length === 0 && (
              <EmptyState
                icon="Sparkles"
                title={t("page.empty.title")}
                body={t("page.empty.body")}
                cta={t("page.empty.cta")}
                onCta={() => setImporting(true)}
              />
            )}
            {list.map((sk) => (
              <SkillCard
                key={sk.id}
                skill={sk}
                active={sk.id === selectedId}
                onClick={() => router.push(`/skills/${sk.id}?tab=${selectedId ? tab : DEFAULT_TAB}`)}
              />
            ))}
          </div>
        </div>

        {/* right: editor or empty prompt */}
        {!selectedId ? (
          <div style={s.detailEmpty}>
            <EmptyState
              icon="Sparkles"
              title={t("page.selectPrompt.title")}
              body={t("page.selectPrompt.body")}
            />
          </div>
        ) : detailLoading || !selected ? (
          <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <Skeleton height={24} width={240} />
            <Skeleton height={200} />
          </div>
        ) : (
          <div style={s.detail}>
            <SkillEditor skill={selected} tab={tab} onTab={setTab} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
