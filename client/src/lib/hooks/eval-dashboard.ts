/* hooks/eval-dashboard.ts — React Query hooks for the Eval Dashboard (SPEC-04).
     GET /eval-dashboard?days=            → EvalWorkspaceDashboard
     GET /agents/:id/versions/:version    → AgentVersion (reused as-is) */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { AgentVersion, EvalWorkspaceDashboard } from "@devdigest/shared";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useEvalWorkspaceDashboard(days: 7 | 30 | 90) {
  return useQuery({
    queryKey: ["eval-workspace-dashboard", days],
    queryFn: () =>
      api.get<EvalWorkspaceDashboard>(`/eval-dashboard?days=${days}`),
  });
}

export function useAgentVersion(
  agentId: string | null | undefined,
  version: number | null | undefined
) {
  return useQuery({
    queryKey: ["agent-version", agentId, version],
    queryFn: () =>
      api.get<AgentVersion>(`/agents/${agentId}/versions/${version}`),
    enabled: !!agentId && version != null,
    // A missing snapshot 404s — the Compare modal must degrade gracefully
    // (AC-27) rather than the query retrying/surfacing a hard error state.
    retry: false,
  });
}
