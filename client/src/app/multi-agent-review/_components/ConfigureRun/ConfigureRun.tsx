/* ConfigureRun — the /multi-agent-review page body (SPEC-05, design 02/03).
   Global route, always PR-scoped through `?pr=<id>`. Picks a PR and an agent
   set; starting a run navigates to `/multi-agent-review/results?pr=<id>`,
   which is where the spec's own flow diagram sends both entry points
   (`K -> L -> M[Results page]`).

   This page never renders results. It used to — results lived inside step 2's
   card behind a `latestRun.data && !reconfiguring` ternary, with a "Run again"
   button to get the picker back. That existed only to satisfy AC-8 ("WHEN a
   PR is selected, list every agent") and AC-18 ("WHERE a PR is in the URL,
   render the latest run") at the same URL. With results on their own route the
   two ACs no longer collide: here a selected PR always shows the agent list.

   One render path throughout: the AppShell chrome and both numbered steps
   always render; only the *content* inside step 2's card varies by state
   (client/INSIGHTS.md — don't early-return a stripped layout per edge state). */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, EmptyState } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { AgentRunPicker } from "@/components/agentRunPicker";
import { useRunReview } from "@/lib/hooks/reviews";
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

  const selectPr = (id: string) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("pr", id);
    router.replace(`/multi-agent-review?${sp.toString()}`);
  };

  // Navigate only once the run is actually created — on failure we stay put so
  // the mutation's error surfaces here rather than on an empty results page.
  const startRun = (agentIds: string[]) => {
    if (!prId) return;
    run.mutate(
      { prId, agentIds },
      { onSuccess: () => router.push(`/multi-agent-review/results?pr=${encodeURIComponent(prId)}`) },
    );
  };

  return (
    <AppShell crumb={[{ label: tRuns("page.crumb") }, { label: t("configure.crumbStep") }]}>
      <div style={s.page}>
        <div style={s.column}>
          <div style={s.pageHeader}>
            <h1 style={s.pageTitle}>{t("configure.title")}</h1>
            <p style={s.pageSubtitle}>{t("configure.subtitle")}</p>
          </div>

          <div style={s.step}>
            <div style={s.stepHeader}>
              <span style={s.stepBadge}>1</span>
              <span style={s.stepLabel}>{t("configure.stepPr")}</span>
            </div>
            <div style={s.stepContent}>
              <PrPicker value={prId} onChange={selectPr} />
            </div>
          </div>

          <div style={s.step}>
            <div style={s.stepHeader}>
              <span style={prId ? s.stepBadge : s.stepBadgeMuted}>2</span>
              <span style={prId ? s.stepLabel : s.stepLabelMuted}>{t("configure.stepAgents")}</span>
            </div>

            <div style={s.stepContent}>
              <Card style={s.agentsCard}>
                {!prId ? (
                  <EmptyState icon="Users" title={t("configure.noPrTitle")} body={t("configure.noPrBody")} />
                ) : (
                  <div style={{ width: "100%" }}>
                    <AgentRunPicker onRun={startRun} isRunning={run.isPending} showSelectAll />
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
