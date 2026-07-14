/* EvalsTab — container for the Agent Editor Evals tab (SPEC-03, T20).
   Owns data-fetching, derived state, and modal open/close logic.
   The presenter (EvalsTabView) handles rendering only. */
"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import type { Agent, EvalRunRecord } from "@devdigest/shared";
import {
  useEvalDashboard,
  useEvalCases,
  useRunEvals,
  useDeleteEvalCase,
} from "../../../../../../../lib/hooks/evals";
import {
  readAndClearEvalPrefill,
  type EvalPrefillPayload,
} from "../../../../../../../lib/eval-prefill";
import { EvalsTabView } from "./EvalsTabView";
import { EvalCaseModal } from "../EvalCaseModal";
import {
  isRunStaleForAgent,
  lastMeasuredAgentVersion,
} from "./helpers";

export function EvalsTab({ agent }: { agent: Agent }) {
  const searchParams = useSearchParams();
  const { data: dashboard, isLoading: dashLoading } = useEvalDashboard(agent.id);
  const { data: cases, isLoading: casesLoading } = useEvalCases(agent.id);
  const runEvals = useRunEvals(agent.id);
  const deleteCase = useDeleteEvalCase(agent.id);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editCaseId, setEditCaseId] = React.useState<string | null>(null);
  const [prefill, setPrefill] = React.useState<EvalPrefillPayload | null>(null);

  // AC-1: on mount, if ?prefill=1 is set, read-and-clear sessionStorage and open the modal
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (searchParams.get("prefill") === "1") {
      const payload = readAndClearEvalPrefill();
      if (payload) {
        setPrefill(payload);
        setModalOpen(true);
      }
    }
  }, []);

  const openNew = React.useCallback(() => {
    setEditCaseId(null);
    setPrefill(null);
    setModalOpen(true);
  }, []);

  const openEdit = React.useCallback((caseId: string) => {
    setEditCaseId(caseId);
    setPrefill(null);
    setModalOpen(true);
  }, []);

  const closeModal = React.useCallback(() => {
    setModalOpen(false);
    setEditCaseId(null);
    setPrefill(null);
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────

  /**
   * Map from case_id → that case's most recent run (AC-33/34).
   *
   * Sourced from each case's own `latest_run`, which the server computes across
   * ALL agent versions with no truncation. Deriving this from
   * `dashboard.recent_runs` instead is wrong: that list is capped at 20 rows and
   * scoped to two agent versions, so a case can fall out of it and render as
   * "never run" despite having been run.
   */
  const latestRunByCase = React.useMemo(() => {
    const map = new Map<string, EvalRunRecord>();
    for (const c of cases ?? []) {
      if (c.latest_run) map.set(c.id, c.latest_run);
    }
    return map;
  }, [cases]);

  /**
   * True if any run in recent_runs belongs to a previous agent version,
   * meaning we have delta data to show (AC-32).
   */
  const hasPreviousVersion = React.useMemo(
    () =>
      (dashboard?.recent_runs ?? []).some(
        (r) => r.agent_version !== agent.version,
      ),
    [dashboard, agent.version],
  );

  /**
   * Current-version-only pass count. Prior-version runs still sit on
   * `latest_run` after a config bump, but they must not inflate "N / M passing"
   * — those scores describe a different agent.
   */
  const passingCount = React.useMemo(
    () =>
      (cases ?? []).filter((c) => {
        const run = latestRunByCase.get(c.id);
        return (
          run != null &&
          !isRunStaleForAgent(run, agent.version) &&
          run.pass === true
        );
      }).length,
    [cases, latestRunByCase, agent.version],
  );

  const currentUnmeasured =
    !dashLoading && (dashboard?.current.traces_total ?? 0) === 0;

  const lastMeasuredVersion = React.useMemo(
    () => lastMeasuredAgentVersion(latestRunByCase.values()),
    [latestRunByCase],
  );

  /** Agent bumped with only older-version runs left — metrics + case status are stale. */
  const fullyStale =
    currentUnmeasured &&
    lastMeasuredVersion != null &&
    lastMeasuredVersion !== agent.version;

  return (
    <>
      <EvalsTabView
        agent={agent}
        dashboard={dashboard ?? null}
        cases={cases ?? []}
        loading={dashLoading || casesLoading}
        runningAll={runEvals.isPending && runEvals.variables === undefined}
        runningCaseId={
          runEvals.isPending && runEvals.variables?.case_ids?.length === 1
            ? (runEvals.variables.case_ids[0] ?? null)
            : null
        }
        hasPreviousVersion={hasPreviousVersion}
        latestRunByCase={latestRunByCase}
        passingCount={passingCount}
        fullyStale={fullyStale}
        lastMeasuredVersion={lastMeasuredVersion}
        onRunAll={() => runEvals.mutate(undefined)}
        onRunCase={(caseId) => runEvals.mutate({ case_ids: [caseId] })}
        onEditCase={openEdit}
        onDeleteCase={(caseId) => deleteCase.mutate(caseId)}
        onNewCase={openNew}
      />
      {modalOpen && (
        <EvalCaseModal
          agent={agent}
          caseId={editCaseId}
          prefill={prefill}
          onClose={closeModal}
        />
      )}
    </>
  );
}
