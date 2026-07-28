/* hooks/ci.ts — React Query hooks for CI export, runs, and installations (SPEC-05).
     POST /agents/:id/export-ci/preview  → CiPreview (non-mutating)
     POST /agents/:id/export-ci          → CiExport JSON or application/zip
     GET  /ci-runs?...                   → CiRun[] (ingest + list)
     GET  /agents/:id/ci-installations   → CiInstallation[] + derived status */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE, ApiError, api } from "../api";
import { useUpdateAgent } from "./agents";
import type {
  CiExport,
  CiExportInputBody,
  CiInstallation,
  CiPreview,
  CiRun,
  CiRunStatus,
  CiFailOn,
} from "@devdigest/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Filters for the CI Runs list (AC-38). Ingest runs on each fetch (AC-26). */
export interface CiRunsFilters {
  repo?: string;
  days?: 7 | 30 | 90;
  agent_id?: string;
  status?: CiRunStatus;
  source?: string;
}

/** Preview/export body — same as export minus `action`. */
export type CiPreviewInput = Omit<CiExportInputBody, "action">;

/** Installation row plus derived status from the latest CI run (AC-41). */
export type CiInstallationWithStatus = CiInstallation & {
  status: string | null;
  /** Latest CI run timestamp when the API provides it; else UI falls back to installed_at. */
  last_run_at?: string | null;
};

export type CiExportZipResult = {
  kind: "zip";
  blob: Blob;
};

export type CiExportJsonResult = {
  kind: "json";
  data: CiExport;
};

export type CiExportResult = CiExportZipResult | CiExportJsonResult;

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

function buildCiRunsPath(filters: CiRunsFilters): string {
  const params = new URLSearchParams();
  if (filters.repo) params.set("repo", filters.repo);
  if (filters.days != null) params.set("days", String(filters.days));
  if (filters.agent_id) params.set("agent_id", filters.agent_id);
  if (filters.status) params.set("status", filters.status);
  if (filters.source) params.set("source", filters.source);
  const qs = params.toString();
  return qs ? `/ci-runs?${qs}` : "/ci-runs";
}

/** POST that returns a binary body (application/zip) — mirrors apiFetch error handling. */
async function postBlob(path: string, body: unknown): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new ApiError(
      `Cannot reach the DevDigest engine at ${API_BASE}. Is the API running?`,
      0,
      "network_error",
      e
    );
  }

  if (!res.ok) {
    let code: string | undefined;
    let message = `${res.status} ${res.statusText}`;
    let details: unknown;
    try {
      const errBody = await res.json();
      if (errBody?.error) {
        code = errBody.error.code;
        message = errBody.error.message ?? message;
        details = errBody.error.details;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, res.status, code, details);
  }

  return res.blob();
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** CI runs list — refresh via explicit `refetch()`, never timer-driven (AC-26). */
export function useCiRuns(filters: CiRunsFilters = {}) {
  return useQuery({
    queryKey: ["ci-runs", filters],
    queryFn: () => api.get<CiRun[]>(buildCiRunsPath(filters)),
  });
}

export function useCiInstallations(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["ci-installations", agentId],
    queryFn: () =>
      api.get<CiInstallationWithStatus[]>(`/agents/${agentId}/ci-installations`),
    enabled: !!agentId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCiPreview() {
  return useMutation({
    mutationFn: ({
      agentId,
      body,
    }: {
      agentId: string;
      body: CiPreviewInput;
    }) => api.post<CiPreview>(`/agents/${agentId}/export-ci/preview`, body),
  });
}

export function useCiExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agentId,
      body,
    }: {
      agentId: string;
      body: CiExportInputBody;
    }): Promise<CiExportResult> => {
      if (body.action === "files") {
        const blob = await postBlob(`/agents/${agentId}/export-ci`, body);
        return { kind: "zip", blob };
      }
      const data = await api.post<CiExport>(`/agents/${agentId}/export-ci`, body);
      return { kind: "json", data };
    },
    onSuccess: (_result, { agentId }) => {
      qc.invalidateQueries({ queryKey: ["ci-installations", agentId] });
    },
  });
}

/** Persist `agents.ci_fail_on` (AC-42) via the shared agent update mutation. */
export function useCiFailOn() {
  const updateAgent = useUpdateAgent();
  return useMutation({
    mutationFn: ({
      agentId,
      ci_fail_on,
    }: {
      agentId: string;
      ci_fail_on: CiFailOn;
    }) => updateAgent.mutateAsync({ id: agentId, patch: { ci_fail_on } }),
  });
}
