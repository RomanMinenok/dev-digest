/* Stats tab — real "Used by N agents" + agents-using panel. The remaining
   metrics (pull/accept/findings) are honest "no data yet" placeholders until a
   finding→skill attribution pipeline exists — never fake a percentage. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MetricCard, Button, Skeleton, ErrorState, Donut } from "@devdigest/ui";
import { CATEGORY_COLORS } from "./constants";
import type { Skill } from "@devdigest/shared";
import { useSkillStats } from "../../../../../../lib/hooks/skills";
import { s } from "./styles";

/** Muted metric tile shown when a metric has no data yet. */
function NoDataCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.noDataCard}>
      <span style={s.noDataLabel}>{label}</span>
      <div style={s.noDataValue}>{value}</div>
    </div>
  );
}

export function StatsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const { data: stats, isLoading, isError, refetch } = useSkillStats(skill.id);

  if (isLoading) return <Skeleton height={120} />;
  if (isError || !stats) return <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />;

  const noData = t("stats.noData");

  return (
    <div style={s.wrap}>
      <div style={s.metrics}>
        <MetricCard label={t("stats.usedBy")} value={stats.used_by} suffix={` ${t("stats.usedByUnit")}`} />
        {stats.pull_rate == null ? (
          <NoDataCard label={t("stats.pullFreq")} value={noData} />
        ) : (
          <MetricCard label={t("stats.pullFreq")} value={`${(stats.pull_rate * 100).toFixed(0)}%`} />
        )}
        {stats.accept_rate == null ? (
          <NoDataCard label={t("stats.acceptRate")} value={noData} />
        ) : (
          <MetricCard label={t("stats.acceptRate")} value={`${(stats.accept_rate * 100).toFixed(0)}%`} />
        )}
        {stats.findings_30d == null ? (
          <NoDataCard label={t("stats.findings30d")} value={noData} />
        ) : (
          <MetricCard label={t("stats.findings30d")} value={stats.findings_30d} />
        )}
      </div>

      <div style={s.panel}>
        <div style={s.panelTitle}>{t("stats.agentsUsing")}</div>
        {stats.agents.length === 0 ? (
          <div style={s.empty}>{t("stats.agentsEmpty")}</div>
        ) : (
          stats.agents.map((a) => (
            <div key={a.id} style={s.agentRow}>
              <span style={s.agentName}>{a.name}</span>
              <Button
                kind="ghost"
                size="sm"
                iconRight="ArrowRight"
                onClick={() => router.push(`/agents/${a.id}?tab=skills`)}
              >
                {t("stats.openAgent")}
              </Button>
            </div>
          ))
        )}
      </div>

      <div style={s.panel}>
        <div style={s.panelTitle}>{t("stats.findingsByCategory")}</div>
        {stats.findings_by_category == null || stats.findings_by_category.length === 0 ? (
          <div style={s.catPlaceholder}>{noData}</div>
        ) : (
          <Donut
            valuePrefix=""
            segments={stats.findings_by_category.map((c, i) => ({
              label: c.category,
              value: c.count,
              color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]!,
            }))}
          />
        )}
      </div>
    </div>
  );
}
