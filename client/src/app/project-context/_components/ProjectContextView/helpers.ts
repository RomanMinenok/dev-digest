import type { Agent } from "@devdigest/shared";

/**
 * Agents that currently have `docPath` attached (AC-4's cross-reference).
 * Computed client-side from the already-fetched agents list — the discovery
 * endpoint (`GET /repos/:repoId/context-docs`) only returns the aggregate
 * `used_by_count`, not per-agent membership, so the "Used by N agents"
 * control's deep-link list (spec Edge cases — "Cross-navigation from the
 * list page") is derived here instead of a new server endpoint.
 */
export function agentsUsingDoc(docPath: string, agents: Agent[]): Agent[] {
  return agents.filter((a) => a.context_docs.includes(docPath));
}

/**
 * Deep-link URL into an Agent's Context tab, carrying the doc path as a
 * query param so the tab (built in T15) can scroll-to/highlight the row.
 */
export function agentContextDeepLink(agentId: string, docPath: string): string {
  return `/agents/${agentId}?contextDoc=${encodeURIComponent(docPath)}`;
}

/** Locale-formatted token count for the scan-summary footer. */
export function formatTokenCount(n: number): string {
  return n.toLocaleString("en-US");
}
