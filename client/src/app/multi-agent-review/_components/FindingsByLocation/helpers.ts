/* Pure helpers for FindingsByLocation (SPEC-05, T-27 — AC-37..AC-43). No
   React imports; everything here is derived from props on every render
   (client/INSIGHTS.md "derive, don't store"). The matched/divergent/agreed
   classification is entirely server-computed (T-05) — nothing here
   recomputes Jaccard or touches a similarity threshold. */
import type { MultiAgentGroup, MultiAgentGroupFinding, MultiAgentMember, Severity } from "@devdigest/shared";
import type { LocationFilter } from "./constants";

/**
 * AC-37: the block renders only once every member run is terminal (any
 * status, not just `'done'`) — mirrors the server's own gate
 * (`server/src/modules/multi-agent/status.ts`) but is re-derived here since
 * only the persisted member `status` is available client-side.
 */
export function allMembersSettled(members: MultiAgentMember[]): boolean {
  return members.every((m) => m.status !== "running");
}

/**
 * A cell's `agent_id` is the server's `memberKey` (`agent_id ?? run_id`,
 * `server/src/modules/multi-agent/service.ts:125-126`) — this map mirrors
 * that fallback so a cell for a since-deleted agent still resolves to a
 * name instead of falling through to the "removed" label unnecessarily.
 */
export function memberNamesByKey(members: MultiAgentMember[], removedAgentLabel: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const member of members) {
    map.set(member.agent_id ?? member.run_id, member.agent_name ?? removedAgentLabel);
  }
  return map;
}

/**
 * The finding behind a `severity` cell — the one whose title the cell shows.
 *
 * Matches on the cell's own `severity` rather than re-deriving "highest wins":
 * the server already applied that rule (`modules/multi-agent/cells.ts:66-70`),
 * so re-implementing its `SEVERITY_RANK` here would be a second copy of the
 * ordering, free to drift. First match wins, mirroring the server's reduce,
 * which keeps the first of several equally-severe findings.
 *
 * Returns `undefined` if nothing matches — the cell then renders its badge
 * alone, exactly as before this line existed.
 */
export function cellFinding(
  group: MultiAgentGroup,
  agentId: string,
  severity: Severity,
): MultiAgentGroupFinding | undefined {
  return group.findings.find((f) => f.agent_id === agentId && f.severity === severity);
}

/** AC-38/AC-39/AC-43: a group may appear under both Divergent and Agreed —
    that is honest, not deduped. All never filters. */
export function filteredGroups(groups: MultiAgentGroup[], filter: LocationFilter): MultiAgentGroup[] {
  if (filter === "matched") return groups.filter((g) => g.matched);
  if (filter === "divergent") return groups.filter((g) => g.divergent);
  if (filter === "agreed") return groups.filter((g) => g.agreed);
  return groups;
}

/** Filter badge counts — always derived from the raw, unfiltered `groups`
    array (client/INSIGHTS.md: counts must not be computed from the already-
    filtered result, or they'd jump around as the active filter changes). */
export function filterCounts(groups: MultiAgentGroup[]): Record<LocationFilter, number> {
  return {
    all: groups.length,
    matched: groups.filter((g) => g.matched).length,
    divergent: groups.filter((g) => g.divergent).length,
    agreed: groups.filter((g) => g.agreed).length,
  };
}

/** Stable key for a location group — grouping is coordinates-only (same
    file + intersecting line range), so file+start+end is unique per run. */
export function groupKey(group: MultiAgentGroup): string {
  return `${group.file}:${group.start_line}-${group.end_line}`;
}
