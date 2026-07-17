/* ResultsColumns — the Columns pane: one lane per member agent (SPEC-05,
   AC-20, AC-24, AC-25).

   Scope note: this used to be the results *orchestrator* (mode switch, trace
   drawer, SSE subscription, "Findings by location") back when results
   rendered inside ConfigureRun's step-2 card. Since results became their own
   route (design 04), `results/_components/ResultsScreen` owns all of that and
   this component is just the grid — it renders lanes and reports "View trace"
   upward. Live per-member status comes from the `events` the screen already
   subscribes to, so this stays presentational (no hooks, no fetching). */
"use client";

import React from "react";
import type { MultiAgentMember, MultiAgentRunView, RunEvent } from "@devdigest/shared";
import { lastEventMessage, type LaneState } from "./helpers";
import { Lane } from "./Lane";
import { s } from "./styles";

export interface ResultsColumnsProps {
  run: MultiAgentRunView;
  /** SSE events for every still-running member, owned by ResultsScreen. */
  events: RunEvent[];
  onViewTrace: (member: MultiAgentMember, state: LaneState) => void;
}

export function ResultsColumns({ run, events, onViewTrace }: ResultsColumnsProps) {
  return (
    <div style={s.grid}>
      {run.members.map((member) => (
        <Lane
          key={member.run_id}
          member={member}
          liveStatus={lastEventMessage(events, member.run_id)}
          onViewTrace={onViewTrace}
        />
      ))}
    </div>
  );
}
