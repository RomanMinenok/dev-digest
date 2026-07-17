/* AgentSummaryCard — the active tab's header card in the Tabs results view
   (SPEC-05, T-26, AC-21). Score ring (done only), name, "View trace", and
   duration/cost — or the live/failed status line while not done. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Avatar, Button, CircularScore } from "@devdigest/ui";
import type { MultiAgentMember } from "@devdigest/shared";
import { formatCost, formatSeconds } from "@/components/RunTraceDrawer/helpers";
import { tabName, type TabState } from "../helpers";
import { s } from "./styles";

export interface AgentSummaryCardProps {
  member: MultiAgentMember;
  state: TabState;
  onViewTrace: () => void;
}

export function AgentSummaryCard({ member, state, onViewTrace }: AgentSummaryCardProps) {
  const t = useTranslations("multiAgent");
  // "View trace" is reused verbatim from the existing "runs" namespace
  // rather than duplicated under a new key.
  const tRuns = useTranslations("runs");
  const name = tabName(member, t("results.removedAgent"));

  return (
    <div style={s.card}>
      <Avatar name={name} size={40} />
      <div style={s.body}>
        <span style={s.name}>{name}</span>
        <span style={s.meta}>
          <SummaryMeta member={member} state={state} />
        </span>
      </div>
      {state === "done" && member.score != null && <CircularScore score={member.score} size={48} stroke={5} />}
      <Button kind="secondary" size="sm" onClick={onViewTrace}>
        {tRuns("viewTrace")}
      </Button>
    </div>
  );
}

function SummaryMeta({ member, state }: { member: MultiAgentMember; state: TabState }) {
  const t = useTranslations("multiAgent");
  if (state === "running") return <>{t("results.running")}</>;
  if (state === "failed") return <>{member.error ?? t("results.runFailed")}</>;
  const duration = member.duration_ms != null ? formatSeconds(member.duration_ms) : "—";
  const cost = formatCost(member.cost_usd);
  return <>{t("results.durationCost", { duration, cost })}</>;
}
