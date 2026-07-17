/* ResultsColumns — the Columns results view for a multi-agent run
   (SPEC-05, T-25/T-26 — AC-19, AC-20, AC-24, AC-25, AC-27). Renders the
   two-mode switcher (Columns | Tabs) over the SAME `MultiAgentRunView`; the
   Tabs pane is T-26's `_components/ResultsTabs/`. One column per member
   (`Lane`); a member's live status while its run is in flight comes from
   the existing SSE stream via `useRunEvents` — no polling, regardless of
   which mode is active. `RunTraceDrawer` (promoted, unmodified) opens on
   "View trace" for that member's run id (AC-27) — one shared drawer
   instance for both modes.

   The "Findings by location" matrix (T-27, `_components/FindingsByLocation/`)
   renders below the mode-conditional block, so it's shared by both Columns
   and Tabs without duplicating the mount — `ResultsTabs` itself never
   renders it standalone since it's only ever reached through this
   component's mode switch. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { RunTraceDrawer } from "@/components/RunTraceDrawer";
import { useRunEvents } from "@/lib/hooks/reviews";
import type { FindingRecord, MultiAgentMember, MultiAgentRunView } from "@devdigest/shared";
import { MODE_COLUMNS, type ResultsMode } from "./constants";
import { lastEventMessage, runningMemberIds, totalCostUsd, totalDurationMs, type LaneState } from "./helpers";
import { Lane } from "./Lane";
import { ModeSwitch } from "./ModeSwitch";
import { ResultsTabs } from "../ResultsTabs";
import { FindingsByLocation } from "../FindingsByLocation";
import { s } from "./styles";
import { formatCost, formatSeconds } from "@/components/RunTraceDrawer/helpers";

export interface ResultsColumnsProps {
  run: MultiAgentRunView;
  /** Called once every previously-running member's SSE stream has closed, so
      the caller can refetch the run and pick up final scores/findings.
      Never polled — this fires exactly once per settle, driven by the
      existing `useRunEvents` stream. */
  onRunSettled: () => void;
}

interface TraceTarget {
  runId: string;
  agentName: string | null;
  state: LaneState;
  findings: FindingRecord[];
}

export function ResultsColumns({ run, onRunSettled }: ResultsColumnsProps) {
  const t = useTranslations("multiAgent");
  const [mode, setMode] = React.useState<ResultsMode>(MODE_COLUMNS);
  const [trace, setTrace] = React.useState<TraceTarget | null>(null);

  const liveIds = runningMemberIds(run.members);
  const { events, running } = useRunEvents(liveIds);

  const wasRunning = React.useRef(false);
  React.useEffect(() => {
    if (running) wasRunning.current = true;
    if (!running && wasRunning.current) {
      wasRunning.current = false;
      onRunSettled();
    }
  }, [running, onRunSettled]);

  const duration = totalDurationMs(run.members);
  const cost = totalCostUsd(run.members);

  return (
    <div style={s.root}>
      <div style={s.contextStrip}>
        <span style={s.contextText}>
          {t("results.contextAgents", { count: run.members.length })}
          {duration != null && t("results.contextDuration", { duration: formatSeconds(duration) })}
          {cost != null && t("results.contextCost", { cost: formatCost(cost) })}
        </span>
        <ModeSwitch mode={mode} onChange={setMode} />
      </div>

      {mode === MODE_COLUMNS ? (
        <div style={s.grid}>
          {run.members.map((member) => (
            <Lane
              key={member.run_id}
              member={member}
              liveStatus={lastEventMessage(events, member.run_id)}
              onViewTrace={(m, state) =>
                setTrace({ runId: m.run_id, agentName: m.agent_name, state, findings: m.findings })
              }
            />
          ))}
        </div>
      ) : (
        <ResultsTabs
          run={run}
          onViewTrace={(m: MultiAgentMember, state) =>
            setTrace({ runId: m.run_id, agentName: m.agent_name, state, findings: m.findings })
          }
        />
      )}

      <FindingsByLocation run={run} />

      {trace && (
        <RunTraceDrawer
          runId={trace.runId}
          agentName={trace.agentName}
          findings={trace.findings}
          running={trace.state === "running"}
          onClose={() => setTrace(null)}
        />
      )}
    </div>
  );
}
