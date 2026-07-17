/* Pure helpers for ResultsTabs (SPEC-05, T-26 — AC-21). No React imports;
   everything here is derived from props on every render (client/INSIGHTS.md
   "derive, don't store"). This mirrors ResultsColumns/helpers.ts's
   `laneState` / `laneName` derivations for the Tabs pane's own active
   member — kept local rather than imported across sibling _components/
   folders, since each results-view folder owns its own small derivation. */
import type { MultiAgentMember } from "@devdigest/shared";
import type { TabDef } from "@devdigest/ui";

export type TabState = "running" | "done" | "failed";

/**
 * A tab's display state, fail-closed like the server's `deriveStatus`
 * (`server/src/modules/multi-agent/status.ts`): only a literal `'running'`
 * keeps it live; only a literal `'done'` renders the score ring; everything
 * else (including `null` and any unrecognised value) renders as failed so a
 * future/unknown status never silently reads as success.
 */
export function tabState(member: MultiAgentMember): TabState {
  if (member.status === "running") return "running";
  if (member.status === "done") return "done";
  return "failed";
}

/** Display name for a tab/summary card — falls back for a deleted agent
    (`agent_id` null; the left-joined `agent_name` is null too). */
export function tabName(member: MultiAgentMember, removedAgentLabel: string): string {
  return member.agent_name ?? removedAgentLabel;
}

/** One tab per member (AC-21), keyed by the stable `run_id` — never an
    array index, since members can be re-ordered by a future sort. The
    member's score becomes the tab's badge count when known. */
export function buildTabs(members: MultiAgentMember[], removedAgentLabel: string): TabDef[] {
  return members.map((member) => ({
    key: member.run_id,
    label: tabName(member, removedAgentLabel),
    count: member.score ?? undefined,
  }));
}
