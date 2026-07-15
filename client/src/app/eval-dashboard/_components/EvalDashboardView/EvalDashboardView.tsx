/* EvalDashboardView — /eval-dashboard container + presenter (mock 01):
   header + `Run all agents` + AGENTS section + the cross-agent
   RECENT EVAL RUNS table. Container fetches via useEvalWorkspaceDashboard;
   loading/empty/error states vary only the content inside the card area — the
   page chrome (AppShell, header, RangePicker) always renders in a single
   render path. The sweep itself lands in T22/T23 — `onRunAll` and per-agent
   `onRun` are wired to no-op placeholders here. */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "../../../../components/app-shell";
import { useEvalWorkspaceDashboard } from "../../../../lib/hooks/eval-dashboard";
import { ApiError } from "../../../../lib/api";
import { RangePicker } from "../RangePicker";
import { useEvalSweep } from "../hooks";
import { AgentsSection } from "./_components/AgentsSection";
import { RunsTable } from "./_components/RunsTable";
import { buildDaysSearch, hasAnyEvalCase, parseDaysParam } from "./helpers";
import { s } from "./styles";

export function EvalDashboardView() {
  const t = useTranslations("eval");
  const router = useRouter();
  const search = useSearchParams();
  const days = parseDaysParam(search.get("days"));

  const { data, isLoading, isError, error, refetch } = useEvalWorkspaceDashboard(days);

  const setDays = (next: typeof days) => {
    router.replace(`/eval-dashboard?${buildDaysSearch(search, next)}`);
  };

  const agents = data?.agents ?? [];
  const versionRuns = data?.version_runs ?? [];

  // Client-driven sweep (AC-35…39). "Run all agents" walks every agent that owns
  // at least one case; per-agent "Run eval" runs just that one.
  const sweep = useEvalSweep();
  const agentsWithCases = agents.filter((a) => a.cases_total > 0).map((a) => a.agent_id);
  const onRunAll = () => {
    void sweep.runAgents(agentsWithCases);
  };
  const onRunAgent = (agentId: string) => {
    void sweep.runAgent(agentId);
  };

  const runAllDisabled =
    isLoading || isError || sweep.isSweeping || !hasAnyEvalCase(agents);
  const workspaceEmpty = !isLoading && !isError && agents.length === 0;

  const crumb = [{ label: t("page.crumbSkillsLab") }, { label: t("page.crumbEvalDashboard") }];

  return (
    <AppShell crumb={crumb}>
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>{t("overviewPage.title")}</h1>
            <p style={s.subtitle}>{t("overviewPage.subtitle")}</p>
          </div>
          <div style={s.actions}>
            <RangePicker value={days} onChange={setDays} />
            <Button
              kind="primary"
              icon="Play"
              loading={sweep.isSweeping}
              disabled={runAllDisabled}
              onClick={onRunAll}
            >
              {sweep.isSweeping ? t("dashboard.running") : t("overviewPage.runAllAgents")}
            </Button>
          </div>
        </div>

        {isLoading && (
          <div style={s.section}>
            <Skeleton height={72} />
            <Skeleton height={72} />
            <Skeleton height={72} />
          </div>
        )}

        {isError && (
          <ErrorState
            body={error instanceof ApiError ? error.message : undefined}
            onRetry={() => refetch()}
          />
        )}

        {workspaceEmpty && <EmptyState icon="Layers" title={t("overviewPage.emptyAgents")} />}

        {sweep.failures.length > 0 && (
          <div style={s.sweepError}>{t("overviewPage.sweepFailed", { count: sweep.failures.length })}</div>
        )}

        {!isLoading && !isError && agents.length > 0 && (
          <>
            <AgentsSection agents={agents} onRun={onRunAgent} runningAgentId={sweep.runningAgentId} />
            <div style={s.section}>
              <div style={s.sectionHeading}>{t("overviewPage.recentRunsHeading")}</div>
              <RunsTable runs={versionRuns} days={days} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
