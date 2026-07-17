/* hooks/multi-agent.ts — React Query hooks for the multi-agent review views
   (SPEC-05). Live lane status comes from `useRunEvents`'s SSE stream, not
   polling — these hooks fetch-once-per-mount + invalidate-on-mutation only. */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type {
  AgentEstimate,
  MultiAgentLatestRunPointer,
  MultiAgentRunView,
} from "@devdigest/shared";

/** Latest multi-agent run for a PR, or `null` when the PR has no such run —
   a legitimate value, not an error. */
export function useLatestMultiAgentRun(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["multi-agent-run", prId],
    queryFn: () => api.get<MultiAgentRunView | null>(`/pulls/${prId}/multi-agent-run`),
    enabled: !!prId,
  });
}

/** Newest multi-agent run in a repo as a pointer, or `null` when the repo has
   never had one — a legitimate value, not an error. Lets the global nav entry
   choose between Configure run and the latest run's results. */
export function useLatestMultiAgentRunForRepo(repoId: string | null | undefined) {
  return useQuery({
    queryKey: ["multi-agent-latest-run", repoId],
    queryFn: () =>
      api.get<MultiAgentLatestRunPointer | null>(
        `/multi-agent/latest-run?repo_id=${encodeURIComponent(repoId as string)}`,
      ),
    enabled: !!repoId,
  });
}

/** Per-agent duration/cost estimates, optionally scoped to a set of agent ids. */
export function useAgentEstimates(agentIds?: string[]) {
  const scope = agentIds && agentIds.length > 0 ? agentIds : null;
  const query = scope ? `?agent_ids=${encodeURIComponent(scope.join(","))}` : "";
  return useQuery({
    // `scope` is part of the key: it changes the response, so omitting it would
    // serve one agent set's estimates from another's cache entry.
    queryKey: ["agent-estimates", scope],
    queryFn: () => api.get<AgentEstimate[]>(`/multi-agent/estimates${query}`),
  });
}
