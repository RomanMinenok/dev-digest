/* AgentEvalView — /eval-dashboard/[agentId] container + presenter (mock 02):
   back link, agent selector + model chip, subtitle, range picker, `Run eval`
   button, the regression banner, the three metric cards with their deltas, the
   metric trend, the Recent Runs table with row selection, and the Compare
   modal. Container fetches (useAgent + useEvalDashboard(agentId, days)); a
   single render path always mounts the full chrome, varying only the card-area
   content for loading/error/empty states. The sweep (`Run eval`) is wired in
   T23; this task (T20) leaves it as a no-op. */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Icon, MetricCard, Skeleton } from "@devdigest/ui";
import type { EvalDashboard, EvalVersionRun } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { useAgent } from "@/lib/hooks/agents";
import { useEvalDashboard } from "@/lib/hooks/evals";
import { ApiError } from "@/lib/api";
import { EVAL_RANGE_DAYS_DEFAULT, EVAL_RANGE_OPTIONS, RangePicker, type EvalRangeDays } from "../../../_components/RangePicker";
import { MetricTrend } from "../MetricTrend";
import { RecentRunsTable } from "../RecentRunsTable";
import { CompareRunsModal } from "../CompareRunsModal";
import { AgentSelector } from "../AgentSelector";
import { useEvalSweep } from "../../../_components/hooks";
import { BACK_HREF, EVAL_METRIC_COLORS, METRIC_CARD_FIELDS } from "./constants";
import { s } from "./styles";

/** Parse the `days` search param, falling back to the default for anything
    missing or not one of the three supported values. Pure + tiny, kept local
    to this component rather than promoted to a helpers.ts (out of scope). */
function parseDaysParam(raw: string | null): EvalRangeDays {
  const parsed = Number(raw);
  const match = EVAL_RANGE_OPTIONS.find((option) => option.value === parsed);
  return match ? match.value : EVAL_RANGE_DAYS_DEFAULT;
}

/**
 * AC-13/AC-32: a delta is only meaningful between two MEASURED versions.
 * `dashboard.delta` is always a real (possibly all-zero) object server-side,
 * so "no previous measured version" must be derived, not read off `delta`
 * being null. `recent_runs` covers both the measured AND previous measured
 * version regardless of the `days` range (see service.ts's dashboard()), so
 * a run at a different agent_version than `measured_version` is proof a
 * previous measured version exists.
 */
function hasPreviousMeasuredVersion(dashboard: EvalDashboard): boolean {
  if (dashboard.measured_version === null) return false;
  return dashboard.recent_runs.some((run) => run.agent_version !== dashboard.measured_version);
}

/** AC-15: an agent with no runs at all renders the cards as "—", never "0%". */
function formatMetricValue(
  dashboard: EvalDashboard | undefined,
  field: (typeof METRIC_CARD_FIELDS)[number]
): string {
  if (!dashboard || dashboard.measured_version === null) return "—";
  return `${Math.round(dashboard.current[field] * 100)}%`;
}

export interface AgentEvalViewProps {
  agentId: string;
}

export function AgentEvalView({ agentId }: AgentEvalViewProps) {
  const t = useTranslations("eval");
  const router = useRouter();
  const search = useSearchParams();
  const days = parseDaysParam(search.get("days"));

  const { data: agent, isLoading: agentLoading, isError: agentError } = useAgent(agentId);
  const {
    data: dashboard,
    isLoading: dashboardLoading,
    isError: dashboardIsError,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useEvalDashboard(agentId, days);

  const setDays = (next: EvalRangeDays) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("days", String(next));
    router.replace(`/eval-dashboard/${agentId}?${sp.toString()}`);
  };

  // The two selected version runs to compare, or null when the modal is closed.
  const [comparePair, setComparePair] = React.useState<[EvalVersionRun, EvalVersionRun] | null>(null);

  // Client-driven per-case sweep for this one agent (AC-35/37/38).
  const sweep = useEvalSweep();
  const onRunEval = () => {
    void sweep.runAgent(agentId);
  };

  const isLoading = agentLoading || dashboardLoading;
  const isError = agentError || dashboardIsError;
  const isStale =
    !!dashboard && dashboard.measured_version !== null && !!agent && dashboard.measured_version !== agent.version;
  const showDelta = !!dashboard && hasPreviousMeasuredVersion(dashboard);

  const crumb = [
    { label: t("page.crumbSkillsLab") },
    { label: t("page.crumbEvalDashboard"), href: BACK_HREF },
    { label: agent?.name ?? "…" },
  ];

  return (
    <AppShell crumb={crumb}>
      <div style={s.page}>
        <span
          role="link"
          tabIndex={0}
          style={s.backLink}
          onClick={() => router.push(BACK_HREF)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push(BACK_HREF);
            }
          }}
        >
          <Icon.ChevronLeft size={14} />
          {t("agentScreen.backToAgents")}
        </span>

        <div style={s.header}>
          <div style={s.headerText}>
            <div style={s.titleRow}>
              {agent ? (
                <AgentSelector agentId={agentId} agentName={agent.name} />
              ) : (
                <h1 style={s.h1}>…</h1>
              )}
              {agent && (
                <span className="mono" style={s.modelChip}>
                  {agent.model}
                </span>
              )}
            </div>
            {dashboard && (
              <p style={s.subtitle}>
                {t("agentScreen.subtitle", {
                  runs: dashboard.version_runs.length,
                  traces: dashboard.cases_total,
                })}
              </p>
            )}
            {isStale && dashboard && (
              <span style={s.staleLabel}>
                {t("agentScreen.lastMeasuredOnVersion", { version: dashboard.measured_version })}
              </span>
            )}
          </div>
          <div style={s.actions}>
            <RangePicker value={days} onChange={setDays} />
            <Button
              kind="primary"
              icon="Play"
              loading={sweep.isSweeping}
              disabled={sweep.isSweeping}
              onClick={onRunEval}
            >
              {sweep.isSweeping ? t("agentScreen.running") : t("agentScreen.runEval")}
            </Button>
          </div>
        </div>

        {sweep.failures.length > 0 && (
          <div style={s.sweepError}>{t("agentScreen.sweepFailed", { count: sweep.failures.length })}</div>
        )}

        {isLoading && (
          <div style={s.section}>
            <Skeleton height={80} />
            <Skeleton height={120} />
          </div>
        )}

        {isError && (
          <ErrorState
            body={dashboardError instanceof ApiError ? dashboardError.message : undefined}
            onRetry={() => refetchDashboard()}
          />
        )}

        {!isLoading && !isError && dashboard && dashboard.cases_total === 0 && (
          <EmptyState icon="Layers" title={t("dashboard.noRuns")} />
        )}

        {!isLoading && !isError && dashboard && dashboard.cases_total > 0 && (
          <>
            {/* Regression banner (AC-30…34): server-composed sentence, rendered
                verbatim — never localized, hidden entirely when null. */}
            {dashboard.alert && (
              <div style={s.banner}>
                <Icon.AlertTriangle size={14} />
                <span>{dashboard.alert}</span>
              </div>
            )}

            <div style={s.cardsRow}>
              {METRIC_CARD_FIELDS.map((field) => (
                <MetricCard
                  key={field}
                  label={t(`dashboard.metrics.${field === "citation_accuracy" ? "citationAccuracy" : field}`)}
                  value={formatMetricValue(dashboard, field)}
                  delta={showDelta ? dashboard.delta[field] : undefined}
                  color={EVAL_METRIC_COLORS[field]}
                />
              ))}
            </div>

            <MetricTrend trend={dashboard.trend} days={days} />

            <RecentRunsTable
              runs={dashboard.version_runs}
              days={days}
              onCompare={setComparePair}
            />
          </>
        )}
      </div>

      {comparePair && (
        <CompareRunsModal
          agentId={agentId}
          pair={comparePair}
          onClose={() => setComparePair(null)}
        />
      )}
    </AppShell>
  );
}
