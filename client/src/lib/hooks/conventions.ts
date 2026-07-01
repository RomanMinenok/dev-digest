/* hooks/conventions.ts — React Query hooks for the Conventions extractor.
     GET  /repos/:id/conventions        → ConventionCandidate[]
     POST /repos/:id/conventions/rescan → ConventionScanResult */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ConventionCandidate, ConventionScanResult } from "@devdigest/shared";

export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: ["conventions", repoId],
    queryFn: () => api.get<ConventionCandidate[]>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
  });
}

export function useRescanConventions(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ConventionScanResult>(`/repos/${repoId}/conventions/rescan`),
    onSuccess: (res) => {
      qc.setQueryData(["conventions", repoId], res.candidates);
    },
  });
}
