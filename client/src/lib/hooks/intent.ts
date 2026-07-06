/* hooks/intent.ts — React Query hooks for the PR Intent card.
     GET  /pulls/:id/intent           → PrIntent | null (lazy trigger: computes if absent/stale)
     POST /pulls/:id/intent/recompute → PrIntent (always overwrites) */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { PrIntent } from "@devdigest/shared";

export function usePrIntent(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["pr-intent", prId],
    queryFn: () => api.get<PrIntent | null>(`/pulls/${prId}/intent`),
    enabled: !!prId,
  });
}

export function useRecomputeIntent(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<PrIntent>(`/pulls/${prId}/intent/recompute`),
    onSuccess: (res) => {
      qc.setQueryData(["pr-intent", prId], res);
    },
  });
}
