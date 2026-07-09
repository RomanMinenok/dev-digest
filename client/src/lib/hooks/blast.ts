/* hooks/blast.ts — React Query hooks for the PR Blast Radius tab.
     GET  /pulls/:id/blast          → BlastRadius (instant, summary:'')
     POST /pulls/:id/blast/explain  → { summary } (one LLM call) */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { BlastRadius } from "@devdigest/shared";

export function useBlast(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["pr-blast", prId],
    queryFn: () => api.get<BlastRadius>(`/pulls/${prId}/blast`),
    enabled: !!prId,
  });
}

export function useExplainBlast(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ summary: string }>(`/pulls/${prId}/blast/explain`),
    onSuccess: (res) => {
      qc.setQueryData<BlastRadius | undefined>(["pr-blast", prId], (prev) =>
        prev ? { ...prev, summary: res.summary } : prev,
      );
    },
  });
}
