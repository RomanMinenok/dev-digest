/* EvalsTabView — presenter for the Agent Editor Evals tab.
   Receives all data + callbacks from EvalsTab (container).
   No data-fetching, no hooks that touch I/O. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Icon, SectionLabel } from "@devdigest/ui";
import type { Agent, EvalCase, EvalDashboard, EvalRunRecord } from "@devdigest/shared";
import { EVAL_METRIC_COLORS } from "@/lib/eval-metric-colors";
import { METRIC_CARDS } from "./constants";
import {
  countActualFindings,
  expectedBadgeLabels,
  isRunStaleForAgent,
  parseExpectedFindings,
} from "./helpers";
import { s } from "./styles";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EvalsTabViewProps {
  agent: Agent;
  dashboard: EvalDashboard | null;
  cases: EvalCase[];
  loading: boolean;
  runningAll: boolean;
  runningCaseId: string | null;
  hasPreviousVersion: boolean;
  latestRunByCase: ReadonlyMap<string, EvalRunRecord>;
  passingCount: number;
  /** True when agent.version is ahead of the last measured eval version. */
  fullyStale: boolean;
  /** Version behind the metric cards (dashboard.measured_version), or null if never run. */
  lastMeasuredVersion: number | null;
  onRunAll: () => void;
  onRunCase: (caseId: string) => void;
  onEditCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
  onNewCase: () => void;
  onViewRun: (caseId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers (display-only)
// ---------------------------------------------------------------------------

function pct(value: number): string {
  return Math.round(value * 100) + "%";
}

function deltaPp(value: number): number {
  return Math.round(value * 100);
}

// ---------------------------------------------------------------------------
// MetricCard sub-component
// ---------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  value: number;
  unavailable: boolean;
  delta: number | null;
  valueColor: string;
}

function MetricCard({ label, value, unavailable, delta, valueColor }: MetricCardProps) {
  const pp = delta !== null ? deltaPp(delta) : 0;
  const deltaStyle =
    delta === null
      ? null
      : pp > 0
        ? { ...s.metricDelta, ...s.metricDeltaPositive }
        : pp < 0
          ? { ...s.metricDelta, ...s.metricDeltaNegative }
          : { ...s.metricDelta, ...s.metricDeltaNeutral };

  const DeltaIcon =
    delta !== null && pp > 0
      ? Icon.TrendingUp
      : delta !== null && pp < 0
        ? Icon.TrendingDown
        : null;

  return (
    <div style={s.metricCard}>
      <div style={s.metricLabel}>{label}</div>
      {unavailable ? (
        <div style={s.metricUnavailable}>—</div>
      ) : (
        <div style={{ ...s.metricValue, color: valueColor }}>{pct(value)}</div>
      )}
      {delta !== null && !unavailable && deltaStyle && (
        <div style={deltaStyle}>
          {DeltaIcon && <DeltaIcon size={11} />}
          {pp > 0 ? "+" : ""}
          {pp}pp
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CaseCard sub-component
// ---------------------------------------------------------------------------

function CaseStatusIcon({
  latestRun,
  stale,
}: {
  latestRun: EvalRunRecord | undefined;
  stale: boolean;
}) {
  // Stale prior-version runs must not look like a current pass/fail — same
  // muted glyph as never-run, so the list does not claim the current config
  // was measured.
  if (latestRun == null || stale) {
    return (
      <span style={s.statusIcon} aria-hidden>
        <span style={s.statusNever} />
      </span>
    );
  }
  if (latestRun.pass === true) {
    return (
      <span style={{ ...s.statusIcon, ...s.statusPassed }} aria-hidden>
        <Icon.CheckCircle size={16} />
      </span>
    );
  }
  if (latestRun.pass === false) {
    return (
      <span style={{ ...s.statusIcon, ...s.statusFailed }} aria-hidden>
        <Icon.XCircle size={16} />
      </span>
    );
  }
  return (
    <span style={s.statusIcon} aria-hidden>
      <span style={s.statusNever} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main presenter
// ---------------------------------------------------------------------------

export function EvalsTabView({
  agent,
  dashboard,
  cases,
  loading,
  runningAll,
  runningCaseId,
  hasPreviousVersion,
  latestRunByCase,
  passingCount,
  fullyStale,
  lastMeasuredVersion,
  onRunAll,
  onRunCase,
  onEditCase,
  onDeleteCase,
  onNewCase,
  onViewRun,
}: EvalsTabViewProps) {
  const t = useTranslations("eval");
  const router = useRouter();

  // Metrics are unavailable until at least one run exists — NOT merely until a
  // case exists. An agent with cases but no runs has no measurement, and
  // rendering its metrics as 0% would read as a catastrophically failing agent
  // rather than an unmeasured one. `traces_total` is the count of runs behind
  // the current aggregate, so 0 ↔ nothing has been run.
  const unavailable =
    !dashboard || loading || dashboard.current.traces_total === 0;
  const totalCount = cases.length;

  const metricsSubtitle = fullyStale
    ? t("evalsTab.metricsSubtitleUnmeasured", {
        version: agent.version,
        measured: lastMeasuredVersion ?? 0,
      })
    : t("evalsTab.metricsSubtitle");

  return (
    <div style={s.wrap}>
      {/* ── Metric cards ───────────────────────────────────────────────── */}
      <div style={s.metricsSection}>
        <SectionLabel
          icon="Gauge"
          right={
            <Button
              kind="ghost"
              size="sm"
              onClick={() => router.push(`/eval-dashboard/${agent.id}`)}
            >
              {t("evalsTab.viewDashboard")}
            </Button>
          }
        >
          {t("evalsTab.metricsTitle")}
        </SectionLabel>
        <span style={s.metricsSubtitle}>{metricsSubtitle}</span>
        {fullyStale && lastMeasuredVersion != null && (
          <div style={s.staleBanner} role="status">
            <Icon.AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              {t("evalsTab.staleVersionBanner", {
                current: agent.version,
                measured: lastMeasuredVersion,
              })}
            </span>
          </div>
        )}
        <div style={s.metricsGrid}>
          {METRIC_CARDS.map(({ labelKey, field }) => {
            const current = dashboard?.current[field as keyof typeof dashboard.current] as
              | number
              | undefined;
            const delta = dashboard?.delta[field as keyof typeof dashboard.delta] as
              | number
              | undefined;
            return (
              <MetricCard
                key={field}
                label={t(labelKey as Parameters<typeof t>[0])}
                value={current ?? 0}
                unavailable={unavailable}
                delta={hasPreviousVersion && !unavailable && delta !== undefined ? delta : null}
                valueColor={EVAL_METRIC_COLORS[field]}
              />
            );
          })}
        </div>
      </div>

      {/* ── Cases list ─────────────────────────────────────────────────── */}
      <div style={s.casesHeader}>
        <div style={s.casesLeft}>
          <span style={s.casesTitle}>{t("evalsTab.casesHeading")}</span>
          {!loading && (
            fullyStale ? (
              <span style={s.notScoredCount}>
                {t("evalsTab.notScoredOnVersion", { version: agent.version })}
              </span>
            ) : (
              <span style={s.passingCount}>
                {t("evalsTab.passingCount", { passing: passingCount, total: totalCount })}
              </span>
            )
          )}
        </div>
        <div style={s.casesRight}>
          <Button
            kind="secondary"
            size="sm"
            icon="Play"
            disabled={runningAll || runningCaseId !== null || totalCount === 0}
            loading={runningAll}
            onClick={onRunAll}
          >
            {runningAll ? t("evalsTab.running") : t("evalsTab.runAll")}
          </Button>
          <Button kind="primary" size="sm" icon="Plus" onClick={onNewCase}>
            {t("evalsTab.newCase")}
          </Button>
        </div>
      </div>

      <div style={s.list}>
        {loading ? (
          <div style={s.loading}>{t("evalsTab.loadingCases")}</div>
        ) : cases.length === 0 ? (
          <div style={s.empty}>{t("evalsTab.emptyCases")}</div>
        ) : (
          cases.map((c) => {
            const latestRun = latestRunByCase.get(c.id);
            const stale =
              latestRun != null && isRunStaleForAgent(latestRun, agent.version);
            const expected = parseExpectedFindings(c.expected_output);
            const badgeLabels = expectedBadgeLabels(expected);
            const subtitle =
              latestRun == null
                ? t("evalsTab.neverRun")
                : stale
                  ? t("evalsTab.staleRun", { version: latestRun.agent_version })
                  : t("evalsTab.expectedGot", {
                      expected: expected.length,
                      got: countActualFindings(latestRun.actual_output),
                    });

            return (
              <div key={c.id} style={s.card}>
                <CaseStatusIcon latestRun={latestRun} stale={stale} />
                <div style={s.cardBody}>
                  <span style={s.cardName}>{c.name}</span>
                  <span style={s.cardSubtitle}>{subtitle}</span>
                </div>
                <div style={s.cardMeta}>
                  <div style={s.badges}>
                    {badgeLabels.length === 0 ? (
                      <span style={{ ...s.badge, ...s.badgeEmpty }}>
                        {t("evalsTab.emptyBadge")}
                      </span>
                    ) : (
                      badgeLabels.map((label) => (
                        <span key={label} style={s.badge}>
                          {label}
                        </span>
                      ))
                    )}
                  </div>
                  <div style={s.cardActions}>
                    <Button
                      kind="ghost"
                      size="sm"
                      icon="Play"
                      disabled={runningAll || runningCaseId !== null}
                      loading={runningCaseId === c.id}
                      onClick={() => onRunCase(c.id)}
                      title={t("evalsTab.run")}
                    />
                    <Button
                      kind="ghost"
                      size="sm"
                      icon="FileText"
                      disabled={!latestRun}
                      onClick={() => onViewRun(c.id)}
                      title={t("evalsTab.viewRun")}
                    />
                    <Button
                      kind="ghost"
                      size="sm"
                      icon="Edit"
                      onClick={() => onEditCase(c.id)}
                      title={t("evalsTab.edit")}
                    />
                    <Button
                      kind="ghost"
                      size="sm"
                      icon="Trash"
                      onClick={() => onDeleteCase(c.id)}
                      title={t("evalsTab.delete")}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
