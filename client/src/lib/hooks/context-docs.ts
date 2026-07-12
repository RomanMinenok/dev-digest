/* hooks/context-docs.ts — React Query hooks for Project Context (SPEC-01):
   repo-level markdown discovery, preview, and agent/skill attachment. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Agent, ContextDoc, Skill } from "@devdigest/shared";

export interface ContextDocsDiscovery {
  docs: ContextDoc[];
  summary: {
    total_count: number;
    total_tokens: number;
  };
}

export interface ContextDocPreview {
  path: string;
  content: string;
  token_estimate: number;
}

/**
 * Discovery list for a repo's `.md` docs + scan-summary footer. Deliberately
 * NOT cached (no `staleTime`) — the token count must always be live
 * (AC-10/AC-13, server/src/modules/project-context/service.ts).
 */
export function useContextDocs(repoId: string | null | undefined) {
  return useQuery({
    queryKey: ["context-docs", repoId],
    queryFn: () => api.get<ContextDocsDiscovery>(`/repos/${repoId}/context-docs`),
    enabled: !!repoId,
  });
}

/**
 * Single doc's exact content + token estimate for the Preview button (AC-9).
 * Deliberately NOT cached (no `staleTime`) — same live-token-count
 * requirement as `useContextDocs`.
 */
export function useContextDocPreview(
  repoId: string | null | undefined,
  path: string | null | undefined
) {
  return useQuery({
    queryKey: ["context-docs-preview", repoId, path],
    queryFn: () =>
      api.get<ContextDocPreview>(
        `/repos/${repoId}/context-docs/preview?path=${encodeURIComponent(path ?? "")}`
      ),
    enabled: !!repoId && !!path,
  });
}

export interface SetAgentContextDocsInput {
  agentId: string;
  context_docs: string[];
}

export function useSetAgentContextDocs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, context_docs }: SetAgentContextDocsInput) =>
      api.post<Agent>(`/agents/${agentId}/context-docs`, { context_docs }),
    onSuccess: (_d, { agentId }) => {
      qc.invalidateQueries({ queryKey: ["agent", agentId] });
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["context-docs"] });
    },
  });
}

export interface SetSkillContextDocsInput {
  skillId: string;
  context_docs: string[];
}

export function useSetSkillContextDocs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ skillId, context_docs }: SetSkillContextDocsInput) =>
      api.post<Skill>(`/skills/${skillId}/context-docs`, { context_docs }),
    onSuccess: (_d, { skillId }) => {
      qc.invalidateQueries({ queryKey: ["skill", skillId] });
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["context-docs"] });
    },
  });
}
