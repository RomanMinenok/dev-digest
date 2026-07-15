/* hooks/evals.ts — React Query hooks for the Agent Eval Cases & Dashboard (L06).
     GET  /agents/:id/eval-cases           → EvalCase[]
     POST /agents/:id/eval-cases           → EvalCase
     PUT  /eval-cases/:id                  → EvalCase
     DELETE /eval-cases/:id               → void
     POST /agents/:id/eval-runs            → EvalRunResult[]  (body: { case_ids? })
     GET  /agents/:id/eval-dashboard       → EvalDashboard   */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  EvalCase,
  EvalCaseInputBody,
  EvalCaseWithLatestRun,
  EvalDashboard,
  EvalRunResult,
} from "@devdigest/shared";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
const evalCasesKey = (agentId: string) => ["eval-cases", agentId] as const;
const evalDashboardKey = (agentId: string) =>
  ["eval-dashboard", agentId] as const;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useEvalCases(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["eval-cases", agentId],
    queryFn: () => api.get<EvalCaseWithLatestRun[]>(`/agents/${agentId}/eval-cases`),
    enabled: !!agentId,
  });
}

export function useEvalDashboard(
  agentId: string | null | undefined,
  days: 7 | 30 | 90 = 30
) {
  return useQuery({
    queryKey: ["eval-dashboard", agentId, days],
    queryFn: () =>
      api.get<EvalDashboard>(`/agents/${agentId}/eval-dashboard?days=${days}`),
    enabled: !!agentId,
  });
}

// ---------------------------------------------------------------------------
// Mutations — all invalidate both query keys on success
// ---------------------------------------------------------------------------

function useInvalidateEvalQueries(agentId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: evalCasesKey(agentId) }),
      qc.invalidateQueries({ queryKey: evalDashboardKey(agentId) }),
    ]);
}

export function useCreateEvalCase(agentId: string) {
  const invalidate = useInvalidateEvalQueries(agentId);
  return useMutation({
    mutationFn: (body: EvalCaseInputBody) =>
      api.post<EvalCase>(`/agents/${agentId}/eval-cases`, body),
    onSuccess: invalidate,
  });
}

export function useUpdateEvalCase(agentId: string) {
  const invalidate = useInvalidateEvalQueries(agentId);
  return useMutation({
    mutationFn: ({
      caseId,
      body,
    }: {
      caseId: string;
      body: EvalCaseInputBody;
    }) => api.put<EvalCase>(`/eval-cases/${caseId}`, body),
    onSuccess: invalidate,
  });
}

export function useDeleteEvalCase(agentId: string) {
  const invalidate = useInvalidateEvalQueries(agentId);
  return useMutation({
    mutationFn: (caseId: string) => api.del<void>(`/eval-cases/${caseId}`),
    onSuccess: invalidate,
  });
}

export function useRunEvals(agentId: string) {
  const invalidate = useInvalidateEvalQueries(agentId);
  return useMutation({
    mutationFn: (body?: { case_ids?: string[] }) =>
      api.post<EvalRunResult[]>(`/agents/${agentId}/eval-runs`, body),
    onSuccess: invalidate,
  });
}
