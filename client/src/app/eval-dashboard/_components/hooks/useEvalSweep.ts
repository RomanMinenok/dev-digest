/* useEvalSweep — client-driven sequential eval executor for the dashboard's
   "Run eval" (one agent) and "Run all agents" (every listed agent) actions
   (AC-35…39). Modelled on the working EvalsTab.handleRunAll: for each agent, for
   each of its case ids, await ONE `POST /agents/:id/eval-runs { case_ids: [id] }`
   (agent by agent, case by case — AC-35/36), invalidating the affected queries
   after every case so cards and metric cards repaint mid-sweep.

   Progress is exposed PER TARGET (`runningAgentId` / `runningCaseId`) derived
   from the in-flight identity — never a single shared mutation's `isPending`
   broadcast to N triggers, which would make one action look like N (AC-37,
   client INSIGHTS). A rejected case is caught and skipped so the sweep
   continues, and the failure is collected for the caller to surface (AC-38).

   Case ids are read per agent via the same query the app already caches
   (`["eval-cases", agentId]`), fetched imperatively with `fetchQuery` because a
   hook cannot be called once per agent in a loop — there is no server-side
   run-all endpoint. */
"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { EvalCaseWithLatestRun, EvalRunResult } from "@devdigest/shared";

export interface EvalSweepFailure {
  agentId: string;
  caseId: string;
  message: string;
}

export interface EvalSweepState {
  /** The agent currently being swept, or null when idle. */
  runningAgentId: string | null;
  /** The case currently being run, or null when idle / between cases. */
  runningCaseId: string | null;
  /** True for the whole multi-agent/multi-case pass, not just one HTTP call. */
  isSweeping: boolean;
  /** Cases that threw during the sweep (surfaced without aborting — AC-38). */
  failures: EvalSweepFailure[];
  /** Run every listed agent, agent by agent, case by case. */
  runAgents: (agentIds: string[]) => Promise<void>;
  /** Convenience for a single agent's "Run eval". */
  runAgent: (agentId: string) => Promise<void>;
}

const evalCasesKey = (agentId: string) => ["eval-cases", agentId] as const;

export function useEvalSweep(): EvalSweepState {
  const qc = useQueryClient();
  const [runningAgentId, setRunningAgentId] = React.useState<string | null>(null);
  const [runningCaseId, setRunningCaseId] = React.useState<string | null>(null);
  const [isSweeping, setIsSweeping] = React.useState(false);
  const [failures, setFailures] = React.useState<EvalSweepFailure[]>([]);

  const invalidate = React.useCallback(
    (agentId: string) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: evalCasesKey(agentId) }),
        qc.invalidateQueries({ queryKey: ["eval-dashboard", agentId] }),
        qc.invalidateQueries({ queryKey: ["eval-workspace-dashboard"] }),
      ]),
    [qc]
  );

  const runAgents = React.useCallback(
    async (agentIds: string[]) => {
      if (isSweeping) return;
      setIsSweeping(true);
      setFailures([]);
      const collected: EvalSweepFailure[] = [];
      try {
        for (const agentId of agentIds) {
          setRunningAgentId(agentId);
          // Reuse the cached eval-cases query; fetch it if not present.
          const cases = await qc.fetchQuery({
            queryKey: evalCasesKey(agentId),
            queryFn: () =>
              api.get<EvalCaseWithLatestRun[]>(`/agents/${agentId}/eval-cases`),
          });
          for (const evalCase of cases) {
            setRunningCaseId(evalCase.id);
            try {
              // Always a truthy body — a falsy body makes api.post send nothing,
              // which 422s the all-optional Zod route (client INSIGHTS).
              await api.post<EvalRunResult[]>(`/agents/${agentId}/eval-runs`, {
                case_ids: [evalCase.id],
              });
            } catch (err) {
              collected.push({
                agentId,
                caseId: evalCase.id,
                message: err instanceof Error ? err.message : String(err),
              });
              setFailures([...collected]);
            }
            // Repaint after every case, pass or fail, so progress is visible.
            await invalidate(agentId);
            setRunningCaseId(null);
          }
        }
      } finally {
        setRunningAgentId(null);
        setRunningCaseId(null);
        setIsSweeping(false);
      }
    },
    [qc, invalidate, isSweeping]
  );

  const runAgent = React.useCallback((agentId: string) => runAgents([agentId]), [runAgents]);

  return { runningAgentId, runningCaseId, isSweeping, failures, runAgents, runAgent };
}
