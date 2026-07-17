/* FilterRow — AC-38 filter chips for /ci-runs. All state lives in URL search
   params; this component only reads/writes them via the App Router. */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dropdown, Icon } from "@devdigest/ui";
import type { DropdownItemDef } from "@devdigest/ui";
import type { CiRunStatus, CiTarget } from "@devdigest/shared";
import { useAgents } from "@/lib/hooks/agents";
import { useActiveRepo } from "@/lib/repo-context";
import {
  CI_RUNS_DAYS_OPTIONS,
  CI_RUNS_PARAM,
  CI_RUNS_REPO_ALL,
  CI_RUNS_SOURCE_OPTIONS,
  CI_RUNS_STATUS_OPTIONS,
  buildCiRunsSearch,
  ciRunsRepoScope,
  parseCiRunsDays,
  parseCiRunsSource,
  parseCiRunsStatus,
  type CiRunsDays,
} from "../../constants";
import { s } from "./styles";

const STATUS_I18N: Record<
  CiRunStatus,
  "succeeded" | "changesRequested" | "error" | "noFindings" | "failed" | "running"
> = {
  succeeded: "succeeded",
  changes_requested: "changesRequested",
  error: "error",
  failed: "failed",
  no_findings: "noFindings",
  running: "running",
};

const SOURCE_I18N: Record<CiTarget, "gha" | "circle" | "jenkins" | "cli"> = {
  gha: "gha",
  circle: "circle",
  jenkins: "jenkins",
  cli: "cli",
};

const DAYS_I18N: Record<CiRunsDays, "last7Days" | "last30Days" | "last90Days"> = {
  7: "last7Days",
  30: "last30Days",
  90: "last90Days",
};

function FilterDropdown({
  icon,
  label,
  items,
  width = 220,
}: {
  icon: React.ReactNode;
  label: string;
  items: DropdownItemDef[];
  width?: number;
}) {
  return (
    <Dropdown
      align="left"
      width={width}
      items={items}
      trigger={
        <button type="button" style={s.trigger} aria-label={label}>
          {icon}
          <span>{label}</span>
          <Icon.ChevronDown size={12} style={s.chevron} />
        </button>
      }
    />
  );
}

export function FilterRow() {
  const t = useTranslations("ci");
  const router = useRouter();
  const search = useSearchParams();
  const { repos, activeRepo } = useActiveRepo();
  const { data: agents } = useAgents();

  const replaceParams = React.useCallback(
    (patch: Partial<Record<(typeof CI_RUNS_PARAM)[keyof typeof CI_RUNS_PARAM], string | null>>) => {
      const qs = buildCiRunsSearch(search, patch);
      router.replace(qs ? `/ci-runs?${qs}` : "/ci-runs", { scroll: false });
    },
    [router, search],
  );

  const days = parseCiRunsDays(search.get(CI_RUNS_PARAM.days));
  const agentId = search.get(CI_RUNS_PARAM.agentId);
  const status = parseCiRunsStatus(search.get(CI_RUNS_PARAM.status));
  const source = parseCiRunsSource(search.get(CI_RUNS_PARAM.source));
  const { scope: repoScope } = ciRunsRepoScope(search);

  const daysLabel = t(`runs.filters.${DAYS_I18N[days]}`);

  const agentLabel =
    agentId != null ? (agents?.find((a) => a.id === agentId)?.name ?? t("runs.filters.allAgents")) : t("runs.filters.allAgents");

  const repoLabel =
    repoScope === "all"
      ? t("runs.filters.allRepos")
      : repoScope === "specific"
        ? (search.get(CI_RUNS_PARAM.repo) ?? t("runs.filters.allRepos"))
        : (activeRepo?.full_name ?? t("runs.filters.allRepos"));

  const statusLabel = status != null ? t(`runs.status.${STATUS_I18N[status]}`) : t("runs.filters.allStatuses");

  const sourceLabel =
    source != null ? t(`exportWizard.targets.${SOURCE_I18N[source]}`) : t("runs.filters.allSources");

  const daysItems: DropdownItemDef[] = CI_RUNS_DAYS_OPTIONS.map((value) => ({
    label: t(`runs.filters.${DAYS_I18N[value]}`),
    icon: "Calendar",
    muted: value === days,
    hint: value === days ? "current" : undefined,
    onClick: () => {
      if (value === days) return;
      replaceParams({
        [CI_RUNS_PARAM.days]: value === 7 ? null : String(value),
      });
    },
  }));

  const agentItems: DropdownItemDef[] = [
    {
      label: t("runs.filters.allAgents"),
      icon: "Boxes",
      muted: agentId == null,
      hint: agentId == null ? "current" : undefined,
      onClick: () => replaceParams({ [CI_RUNS_PARAM.agentId]: null }),
    },
    ...(agents ?? []).map((agent) => ({
      label: agent.name,
      icon: "Boxes" as const,
      muted: agent.id === agentId,
      hint: agent.id === agentId ? "current" : undefined,
      onClick: () => replaceParams({ [CI_RUNS_PARAM.agentId]: agent.id }),
    })),
  ];

  const repoItems: DropdownItemDef[] = [
    {
      label: t("runs.filters.allRepos"),
      icon: "GitBranch",
      muted: repoScope === "all",
      hint: repoScope === "all" ? "current" : undefined,
      onClick: () => replaceParams({ [CI_RUNS_PARAM.repo]: CI_RUNS_REPO_ALL }),
    },
    ...(repos ?? []).map((repo) => ({
      label: repo.full_name,
      icon: "GitBranch" as const,
      muted:
        (repoScope === "active" && repo.id === activeRepo?.id) ||
        (repoScope === "specific" && repo.full_name === search.get(CI_RUNS_PARAM.repo)),
      hint:
        (repoScope === "active" && repo.id === activeRepo?.id) ||
        (repoScope === "specific" && repo.full_name === search.get(CI_RUNS_PARAM.repo))
          ? "current"
          : undefined,
      onClick: () => {
        if (repo.id === activeRepo?.id) {
          replaceParams({ [CI_RUNS_PARAM.repo]: null });
        } else {
          replaceParams({ [CI_RUNS_PARAM.repo]: repo.full_name });
        }
      },
    })),
  ];

  const statusItems: DropdownItemDef[] = [
    {
      label: t("runs.filters.allStatuses"),
      icon: "Filter",
      muted: status == null,
      hint: status == null ? "current" : undefined,
      onClick: () => replaceParams({ [CI_RUNS_PARAM.status]: null }),
    },
    ...CI_RUNS_STATUS_OPTIONS.map((value) => ({
      label: t(`runs.status.${STATUS_I18N[value]}`),
      icon: "Filter" as const,
      muted: value === status,
      hint: value === status ? "current" : undefined,
      onClick: () => replaceParams({ [CI_RUNS_PARAM.status]: value }),
    })),
  ];

  const sourceItems: DropdownItemDef[] = [
    {
      label: t("runs.filters.allSources"),
      icon: "Link",
      muted: source == null,
      hint: source == null ? "current" : undefined,
      onClick: () => replaceParams({ [CI_RUNS_PARAM.source]: null }),
    },
    ...CI_RUNS_SOURCE_OPTIONS.map((value) => ({
      label: t(`exportWizard.targets.${SOURCE_I18N[value]}`),
      icon: "Link" as const,
      muted: value === source,
      hint: value === source ? "current" : undefined,
      onClick: () => replaceParams({ [CI_RUNS_PARAM.source]: value }),
    })),
  ];

  return (
    <div style={s.row} aria-label="Filters">
      <FilterDropdown
        icon={<Icon.Calendar size={12} />}
        label={daysLabel}
        items={daysItems}
        width={180}
      />
      <FilterDropdown icon={<Icon.Boxes size={12} />} label={agentLabel} items={agentItems} width={240} />
      <FilterDropdown icon={<Icon.GitBranch size={12} />} label={repoLabel} items={repoItems} width={280} />
      <FilterDropdown icon={<Icon.Filter size={12} />} label={statusLabel} items={statusItems} width={200} />
      <FilterDropdown icon={<Icon.Link size={12} />} label={sourceLabel} items={sourceItems} width={220} />
    </div>
  );
}
