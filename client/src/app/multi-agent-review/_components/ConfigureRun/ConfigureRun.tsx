/* ConfigureRun — the /multi-agent-review page body (SPEC-05, T-24). Global
   route, always PR-scoped through `?pr=<id>`. One render path throughout:
   the AppShell chrome and the two numbered steps always render; only the
   *content* inside step 2's card varies by state (client/INSIGHTS.md — don't
   early-return a stripped layout per edge state).

   Results rendering (Columns/Tabs/matrix) is NOT this task — when a latest
   run already exists this renders a placeholder seam for T-25/T-26/T-27,
   never a fallback to unrelated single-agent runs from the PR's history.

   T-25 update: the placeholder is now `ResultsColumns` (Columns/Tabs
   switcher + lanes); it owns everything below step 2's card header. */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, EmptyState, Skeleton, ErrorState } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { AgentRunPicker } from "@/components/agentRunPicker";
import { useLatestMultiAgentRun } from "@/lib/hooks/multi-agent";
import { useRunReview } from "@/lib/hooks/reviews";
import { ApiError } from "@/lib/api";
import { ResultsColumns } from "../ResultsColumns";
import { PrPicker } from "./PrPicker";
import { s } from "./styles";

export function ConfigureRun() {
  const router = useRouter();
  const search = useSearchParams();
  const t = useTranslations("multiAgent");
  // Reuse the "Multi-Agent Review" crumb verbatim from the existing "runs"
  // namespace rather than duplicating it (client/INSIGHTS.md: reuse keys
  // across a second `useTranslations` namespace instead of re-declaring).
  const tRuns = useTranslations("runs");
  const prId = search.get("pr");

  const run = useRunReview();
  const latestRun = useLatestMultiAgentRun(prId);

  // Reveals the picker over an existing run's results (AC-8). Keyed off the
  // PR so switching PRs never carries the reconfiguring state across.
  const [reconfiguringPr, setReconfiguringPr] = React.useState<string | null>(null);
  const reconfiguring = prId !== null && reconfiguringPr === prId;
  const setReconfiguring = (on: boolean) => setReconfiguringPr(on ? prId : null);

  const selectPr = (id: string) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("pr", id);
    router.replace(`/multi-agent-review?${sp.toString()}`);
  };

  const startRun = (agentIds: string[]) => {
    if (!prId) return;
    // Back to results: the new run replaces the one we were reconfiguring over.
    setReconfiguringPr(null);
    run.mutate({ prId, agentIds });
  };

  return (
    <AppShell crumb={[{ label: tRuns("page.crumb") }, { label: t("configure.crumbStep") }]}>
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>{t("configure.title")}</h1>
        <p style={s.pageSubtitle}>{t("configure.subtitle")}</p>
      </div>

      <div style={s.step}>
        <div style={s.stepHeader}>
          <span style={s.stepBadge}>1</span>
          <span style={s.stepLabel}>{t("configure.stepPr")}</span>
        </div>
        <PrPicker value={prId} onChange={selectPr} />
      </div>

      <div style={s.step}>
        <div style={s.stepHeader}>
          <span style={prId ? s.stepBadge : s.stepBadgeMuted}>2</span>
          <span style={prId ? s.stepLabel : s.stepLabelMuted}>{t("configure.stepAgents")}</span>
        </div>

        <Card style={s.agentsCard}>
          {!prId ? (
            <EmptyState icon="Users" title={t("configure.noPrTitle")} body={t("configure.noPrBody")} />
          ) : latestRun.isLoading ? (
            <div style={{ width: "100%" }}>
              <Skeleton height={120} />
            </div>
          ) : latestRun.isError ? (
            <ErrorState
              title={t("configure.loadErrorTitle")}
              body={latestRun.error instanceof ApiError ? latestRun.error.message : t("configure.tryAgain")}
              onRetry={() => latestRun.refetch()}
            />
          ) : latestRun.data && !reconfiguring ? (
            <div style={{ width: "100%" }}>
              <ResultsColumns run={latestRun.data} onRunSettled={() => latestRun.refetch()} />
              {/* AC-8 requires the agent list + Select all whenever a PR is
                  selected — not only before its first run. Results own the
                  card by default (a re-run is the rarer intent), so the picker
                  stays one click away rather than permanently doubling the
                  card's height. */}
              <button type="button" style={s.runAgain} onClick={() => setReconfiguring(true)}>
                {t("configure.runAgain")}
              </button>
            </div>
          ) : (
            <div style={{ width: "100%" }}>
              <AgentRunPicker onRun={startRun} isRunning={run.isPending} showSelectAll />
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
