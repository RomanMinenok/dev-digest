/* ResultsScreen — the /multi-agent-review/results page body (SPEC-05 design
   04/05). Owns everything that used to live inside ConfigureRun's step-2
   card: the mode state, the trace drawer, the live SSE subscription, and
   design 04's header row (back button · title · "N selected agents ·
   parallel" · Columns|Tabs) + context strip (#PR · title · totals).

   `ResultsColumns` / `ResultsTabs` / `FindingsByLocation` stay in the PARENT
   route's `_components/` — they're shared across the /multi-agent-review
   subtree, which is exactly the case client/INSIGHTS.md's promotion rule
   keeps in the parent rather than moving to src/components/.

   One render path throughout: the shell, header row and context strip always
   mount; only the body varies by state (client/INSIGHTS.md — never
   early-return a stripped layout per edge state). */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Card, ErrorState, Skeleton } from "@devdigest/ui";
import type { FindingRecord, MultiAgentMember } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { RunTraceDrawer } from "@/components/RunTraceDrawer";
import { formatCost, formatSeconds } from "@/components/RunTraceDrawer/helpers";
import { usePullDetail } from "@/lib/hooks/core";
import { useLatestMultiAgentRun } from "@/lib/hooks/multi-agent";
import { useRunEvents } from "@/lib/hooks/reviews";
import { ApiError } from "@/lib/api";
import { ResultsColumns } from "../../../_components/ResultsColumns";
import { MODE_COLUMNS, type ResultsMode } from "../../../_components/ResultsColumns/constants";
import {
  runningMemberIds,
  totalCostUsd,
  totalDurationMs,
  type LaneState,
} from "../../../_components/ResultsColumns/helpers";
import { ModeSwitch } from "../../../_components/ResultsColumns/ModeSwitch";
import { ResultsTabs } from "../../../_components/ResultsTabs";
import { FindingsByLocation } from "../../../_components/FindingsByLocation";
import { s } from "./styles";

interface TraceTarget {
  runId: string;
  agentName: string | null;
  state: LaneState;
  findings: FindingRecord[];
}

export function ResultsScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const t = useTranslations("multiAgent");
  const tRuns = useTranslations("runs");
  const prId = search.get("pr");

  const latestRun = useLatestMultiAgentRun(prId);
  const pr = usePullDetail(prId);

  const [mode, setMode] = React.useState<ResultsMode>(MODE_COLUMNS);
  const [trace, setTrace] = React.useState<TraceTarget | null>(null);

  const run = latestRun.data ?? null;
  const liveIds = runningMemberIds(run?.members ?? []);
  const { events, running } = useRunEvents(liveIds);

  // Refetch once every previously-running member's stream has closed, so final
  // scores/findings land. Fires exactly once per settle — never polled.
  const refetch = latestRun.refetch;
  const wasRunning = React.useRef(false);
  React.useEffect(() => {
    if (running) wasRunning.current = true;
    if (!running && wasRunning.current) {
      wasRunning.current = false;
      refetch();
    }
  }, [running, refetch]);

  // This route is meaningless without a PR, and without a run there is
  // nothing to show — in both cases Configure run is the right home, so we
  // send the user there rather than parking them on a dead end.
  const noRun = !latestRun.isLoading && !latestRun.isError && latestRun.data === null;
  React.useEffect(() => {
    if (!prId) {
      router.replace("/multi-agent-review");
      return;
    }
    if (noRun) router.replace(`/multi-agent-review?pr=${encodeURIComponent(prId)}`);
  }, [prId, noRun, router]);

  const duration = totalDurationMs(run?.members ?? []);
  const cost = totalCostUsd(run?.members ?? []);

  const viewTrace = (member: MultiAgentMember, state: LaneState) =>
    setTrace({ runId: member.run_id, agentName: member.agent_name, state, findings: member.findings });

  const crumb = [
    { label: tRuns("page.crumb") },
    ...(pr.data ? [{ label: t("results.prNumber", { number: pr.data.number }) }] : []),
  ];

  return (
    <AppShell crumb={crumb}>
      <div style={s.page}>
        <div style={s.wide}>
          <div style={s.headerRow}>
            <Button
              kind="secondary"
              size="sm"
              icon="Settings"
              onClick={() => router.push(prId ? `/multi-agent-review?pr=${encodeURIComponent(prId)}` : "/multi-agent-review")}
            >
              {t("results.back")}
            </Button>
            <h1 style={s.title}>{t("results.title")}</h1>
            {run && <span style={s.subtitle}>{t("results.subtitle", { count: run.members.length })}</span>}
            <div style={s.headerRight}>{run && <ModeSwitch mode={mode} onChange={setMode} />}</div>
          </div>

          <div style={s.contextStrip}>
            {pr.data && <span style={s.prNumber}>{t("results.prNumber", { number: pr.data.number })}</span>}
            {pr.data && <span style={s.prTitle}>{pr.data.title}</span>}
            {run && (
              <span style={s.totals}>
                {t("results.contextAgents", { count: run.members.length })}
                {duration != null && t("results.contextDuration", { duration: formatSeconds(duration) })}
                {cost != null && t("results.contextCost", { cost: formatCost(cost) })}
              </span>
            )}
          </div>

          {latestRun.isError ? (
            <Card style={s.stateCard}>
              <ErrorState
                title={t("configure.loadErrorTitle")}
                body={latestRun.error instanceof ApiError ? latestRun.error.message : t("configure.tryAgain")}
                onRetry={() => latestRun.refetch()}
              />
            </Card>
          ) : !run ? (
            <Card style={s.stateCard}>
              <div style={{ width: "100%" }}>
                <Skeleton height={160} />
              </div>
            </Card>
          ) : (
            <div style={s.body}>
              {mode === MODE_COLUMNS ? (
                <ResultsColumns run={run} events={events} onViewTrace={viewTrace} />
              ) : (
                <ResultsTabs run={run} onViewTrace={viewTrace} />
              )}
              <FindingsByLocation run={run} />
            </div>
          )}
        </div>
      </div>

      {trace && (
        <RunTraceDrawer
          runId={trace.runId}
          agentName={trace.agentName}
          findings={trace.findings}
          running={trace.state === "running"}
          onClose={() => setTrace(null)}
        />
      )}
    </AppShell>
  );
}
