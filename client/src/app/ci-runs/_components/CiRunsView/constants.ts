import type { CiRunStatus, CiTarget } from "@devdigest/shared";
import type { CiRunsFilters } from "@/lib/hooks/ci";

/** Default list window — inside GitHub's 90-day artifact retention (AC-38). */
export const CI_RUNS_DAYS_DEFAULT = 7 as const;

export type CiRunsDays = 7 | 30 | 90;

export const CI_RUNS_DAYS_OPTIONS: CiRunsDays[] = [7, 30, 90];

/** URL search param names — must match `GET /ci-runs` querystring (AC-38). */
export const CI_RUNS_PARAM = {
  days: "days",
  agentId: "agent_id",
  repo: "repo",
  status: "status",
  source: "source",
} as const;

/** URL sentinel for workspace-wide scope — not sent to the API (Decision 6). */
export const CI_RUNS_REPO_ALL = "all";

export const CI_RUNS_STATUS_OPTIONS: CiRunStatus[] = [
  "succeeded",
  "changes_requested",
  "error",
  "no_findings",
  "running",
];

export const CI_RUNS_SOURCE_OPTIONS: CiTarget[] = ["gha", "circle", "jenkins", "cli"];

export const DEFAULT_CI_RUNS_FILTERS: CiRunsFilters = {
  days: CI_RUNS_DAYS_DEFAULT,
};

/** Table column labels not yet in `messages/en/ci.json`. */
export const COLUMN_LABELS = {
  agent: "Agent",
  duration: "Dur.",
} as const;

export function parseCiRunsDays(raw: string | null): CiRunsDays {
  const n = Number(raw);
  return (CI_RUNS_DAYS_OPTIONS as number[]).includes(n) ? (n as CiRunsDays) : CI_RUNS_DAYS_DEFAULT;
}

export function parseCiRunsStatus(raw: string | null): CiRunStatus | undefined {
  if (!raw) return undefined;
  return CI_RUNS_STATUS_OPTIONS.includes(raw as CiRunStatus) ? (raw as CiRunStatus) : undefined;
}

export function parseCiRunsSource(raw: string | null): CiTarget | undefined {
  if (!raw) return undefined;
  return CI_RUNS_SOURCE_OPTIONS.includes(raw as CiTarget) ? (raw as CiTarget) : undefined;
}

/**
 * Resolve API filters from URL search params plus the active-repo default
 * when `repo` is absent (Decision 6).
 */
export function ciRunsFiltersFromSearch(
  search: URLSearchParams,
  activeRepoFullName?: string | null,
): CiRunsFilters {
  const days = parseCiRunsDays(search.get(CI_RUNS_PARAM.days));
  const agent_id = search.get(CI_RUNS_PARAM.agentId) ?? undefined;
  const status = parseCiRunsStatus(search.get(CI_RUNS_PARAM.status));
  const source = parseCiRunsSource(search.get(CI_RUNS_PARAM.source));

  const repoRaw = search.get(CI_RUNS_PARAM.repo);
  let repo: string | undefined;
  if (repoRaw === CI_RUNS_REPO_ALL) {
    repo = undefined;
  } else if (repoRaw) {
    repo = repoRaw;
  } else if (activeRepoFullName) {
    repo = activeRepoFullName;
  }

  const filters: CiRunsFilters = { days };
  if (repo) filters.repo = repo;
  if (agent_id) filters.agent_id = agent_id;
  if (status) filters.status = status;
  if (source) filters.source = source;
  return filters;
}

export type CiRunsRepoScope = "active" | "all" | "specific";

/** How the repository filter should read in the UI. */
export function ciRunsRepoScope(search: URLSearchParams): {
  scope: CiRunsRepoScope;
  repoValue?: string;
} {
  const raw = search.get(CI_RUNS_PARAM.repo);
  if (raw === CI_RUNS_REPO_ALL) return { scope: "all" };
  if (raw) return { scope: "specific", repoValue: raw };
  return { scope: "active" };
}

/** Merge filter changes into the current query string, preserving unrelated params. */
export function buildCiRunsSearch(
  current: URLSearchParams,
  patch: Partial<Record<(typeof CI_RUNS_PARAM)[keyof typeof CI_RUNS_PARAM], string | null>>,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, val] of Object.entries(patch)) {
    if (val == null || val === "") next.delete(key);
    else next.set(key, val);
  }
  return next.toString();
}
