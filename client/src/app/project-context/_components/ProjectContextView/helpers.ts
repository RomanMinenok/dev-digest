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

const ROOT_BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  docs: { bg: "var(--green-tint, #16382a)", fg: "var(--green-text, #4ade80)" },
};
const DEFAULT_BADGE_COLOR = { bg: "var(--bg-elevated)", fg: "var(--text-secondary)" };

/** Root-folder badge label for a repo-relative path: first path segment
 * uppercased, or "ROOT" for a file with no directory. */
export function docRootLabel(path: string): string {
  const idx = path.indexOf("/");
  return idx === -1 ? "ROOT" : path.slice(0, idx).toUpperCase();
}

/** Badge colors for a root-folder label (from docRootLabel); "docs" gets a
 * distinct accent, every other folder (including ROOT) shares a neutral
 * style so new top-level folders don't need a color added here. */
export function docRootBadgeColor(rootLabel: string) {
  return ROOT_BADGE_COLORS[rootLabel.toLowerCase()] ?? DEFAULT_BADGE_COLOR;
}

/** Bare filename (last path segment) for the row/detail heading. */
export function docFileName(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? path : path.slice(idx + 1);
}

/** Directory portion of a path, with trailing slash; "" for a root-level
 * file (row still renders an empty second line to keep row heights
 * consistent). */
export function docDirName(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : `${path.slice(0, idx)}/`;
}
