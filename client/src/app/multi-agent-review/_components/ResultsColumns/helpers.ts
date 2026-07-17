/* Pure helpers for ResultsColumns (SPEC-05, T-25 — AC-20, AC-24, AC-25).
   No React imports; everything here is derived from props on every render
   (client/INSIGHTS.md "derive, don't store"). The "Removed agent" copy
   (T-28, `messages/en/multiAgent.json` "results.removedAgent") is passed in
   by the caller rather than looked up here with `useTranslations`. */
import type { MultiAgentMember } from "@devdigest/shared";
import type { RunEvent } from "@devdigest/shared";

export type LaneState = "running" | "done" | "failed";

/**
 * A lane's display state, fail-closed like the server's `deriveStatus`
 * (`server/src/modules/multi-agent/status.ts`): only a literal `'running'`
 * keeps the lane live; only a literal `'done'` renders the score ring;
 * everything else (including `null` and any unrecognised value) renders as
 * failed so a future/unknown status never silently reads as success.
 */
export function laneState(member: MultiAgentMember): LaneState {
  if (member.status === "running") return "running";
  if (member.status === "done") return "done";
  return "failed";
}

/** Display name for a lane header — falls back for a deleted agent
    (`agent_id` null; the left-joined `agent_name` is null too). */
export function laneName(member: MultiAgentMember, removedAgentLabel: string): string {
  return member.agent_name ?? removedAgentLabel;
}

/** Most recent SSE log message for one member's run, or `undefined` before
    any event has arrived for it yet. Used as the lane header's live status
    line while a member is still running (AC-24). */
export function lastEventMessage(events: RunEvent[], runId: string): string | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i]!.runId === runId) return events[i]!.msg;
  }
  return undefined;
}

/** Run ids of members whose *persisted* status is still `'running'` — the
    set to subscribe `useRunEvents` to on mount (no polling: re-subscribing
    to still-running members is all that's needed, per client/INSIGHTS.md). */
export function runningMemberIds(members: MultiAgentMember[]): string[] {
  return members.filter((m) => m.status === "running").map((m) => m.run_id);
}

/** Context-strip total duration — the max across members with a known
    duration, since the runs fan out in parallel (mirrors
    `components/agentRunPicker/helpers.ts`'s `estimateTotals`). Members with
    no duration yet (still running / failed before starting) are excluded. */
export function totalDurationMs(members: MultiAgentMember[]): number | null {
  const durations = members
    .map((m) => m.duration_ms)
    .filter((d): d is number => d !== null);
  return durations.length > 0 ? Math.max(...durations) : null;
}

/** Context-strip total cost — summed across every member with a known cost
    (every member that actually ran is paid for). */
export function totalCostUsd(members: MultiAgentMember[]): number | null {
  const costs = members.map((m) => m.cost_usd).filter((c): c is number => c !== null);
  return costs.length > 0 ? costs.reduce((sum, c) => sum + c, 0) : null;
}
