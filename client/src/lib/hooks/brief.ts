/* hooks/brief.ts — React Query hooks for the PR Brief card.
     GET  /pulls/:id/brief           → PrBrief | null (lazy trigger: computes if absent/stale)
     POST /pulls/:id/brief/recompute → PrBrief (always overwrites) */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { PrBrief } from "@devdigest/shared";

export function usePrBrief(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["pr-brief", prId],
    queryFn: () => api.get<PrBrief | null>(`/pulls/${prId}/brief`),
    enabled: !!prId,
  });
}

export function useRecomputeBrief(prId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<PrBrief>(`/pulls/${prId}/brief/recompute`),
    onSuccess: (res) => {
      qc.setQueryData(["pr-brief", prId], res);
    },
  });
}
