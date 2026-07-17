/* Lane — one member-agent column in the Columns results view (SPEC-05, T-25,
   AC-20/AC-24/AC-25). Header: avatar + name + duration/cost (or live status
   while running, or the run's error while failed) + score ring (done only).
   Body: a stack of finding cards. Footer: "View trace" + finding count. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Avatar, Button, CircularScore, Icon } from "@devdigest/ui";
import type { MultiAgentMember } from "@devdigest/shared";
import { formatCost, formatSeconds } from "@/components/RunTraceDrawer/helpers";
import { laneName, laneState, type LaneState } from "../helpers";
import { s, findingCard, findingIconColor, findingLocation, findingTitleRow } from "./styles";

export interface LaneProps {
  member: MultiAgentMember;
  /** Latest live-log message for this member's run, once one has arrived. */
  liveStatus?: string;
  onViewTrace: (member: MultiAgentMember, state: LaneState) => void;
}

export function Lane({ member, liveStatus, onViewTrace }: LaneProps) {
  const t = useTranslations("multiAgent");
  // "View trace" is reused verbatim from the existing "runs" namespace
  // rather than duplicated under a new key.
  const tRuns = useTranslations("runs");
  const state = laneState(member);
  const name = laneName(member, t("results.removedAgent"));

  return (
    <div style={s.card}>
      <div style={s.header}>
        <Avatar name={name} size={32} />
        <div style={s.headerBody}>
          <span style={s.headerName}>{name}</span>
          <LaneHeaderMeta member={member} state={state} liveStatus={liveStatus} />
        </div>
        {state === "done" && member.score != null && <CircularScore score={member.score} size={40} stroke={4} />}
      </div>

      <div style={s.body}>
        {state === "failed" ? (
          <div style={s.errorBox}>{member.error ?? t("results.runFailed")}</div>
        ) : member.findings.length === 0 ? (
          <div style={s.emptyNote}>{state === "running" ? t("results.running") : t("results.noFindings")}</div>
        ) : (
          member.findings.map((finding) => (
            <div key={finding.id} style={findingCard(finding.severity)}>
              <div style={findingTitleRow}>
                <FindingSeverityIcon severity={finding.severity} />
                <span>{finding.title}</span>
              </div>
              <span style={findingLocation}>
                {finding.file}:{finding.start_line}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={s.footer}>
        <Button kind="secondary" size="sm" onClick={() => onViewTrace(member, state)}>
          {tRuns("viewTrace")}
        </Button>
        <span style={s.footerCount}>{t("results.findingsCount", { count: member.findings.length })}</span>
      </div>
    </div>
  );
}

function LaneHeaderMeta({
  member,
  state,
  liveStatus,
}: {
  member: MultiAgentMember;
  state: LaneState;
  liveStatus?: string;
}) {
  const t = useTranslations("multiAgent");
  if (state === "running") {
    return <span style={s.headerMeta}>{liveStatus ?? t("results.running")}</span>;
  }
  if (state === "failed") {
    return <span style={s.headerMeta}>{member.error ?? t("results.failed")}</span>;
  }
  const duration = member.duration_ms != null ? formatSeconds(member.duration_ms) : "—";
  const cost = formatCost(member.cost_usd);
  return <span style={s.headerMeta}>{t("results.durationCost", { duration, cost })}</span>;
}

function FindingSeverityIcon({ severity }: { severity: MultiAgentMember["findings"][number]["severity"] }) {
  const Icons = { CRITICAL: Icon.AlertOctagon, WARNING: Icon.AlertTriangle, SUGGESTION: Icon.Lightbulb } as const;
  const I = Icons[severity];
  return <I size={13} style={{ color: findingIconColor(severity), flexShrink: 0, marginTop: 1 }} />;
}
