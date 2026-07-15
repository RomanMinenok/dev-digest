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
import { EvalRunDetailModal } from "../EvalRunDetailModal";
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
  const [viewRunCaseId, setViewRunCaseId] = React.useState<string | null>(null);
  /** True for the whole sequential "Run all" pass (not just one case's HTTP call). */
  const [runAllActive, setRunAllActive] = React.useState(false);

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

  const closeRunDetail = React.useCallback(() => setViewRunCaseId(null), []);

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

  /**
   * Prefer the dashboard's measured_version — that is exactly which version
   * `dashboard.current` aggregates (SPEC-04). Fall back to max case latest_run
   * version when the dashboard hasn't loaded yet / has no runs.
   */
  const lastMeasuredVersion = React.useMemo(() => {
    if (dashboard?.measured_version != null) return dashboard.measured_version;
    return lastMeasuredAgentVersion(latestRunByCase.values());
  }, [dashboard?.measured_version, latestRunByCase]);

  /**
   * Agent config is ahead of the last eval sweep. Metrics stay visible (they
   * are the last-measured aggregates) but labelled stale via the banner —
   * `current.traces_total === 0` is no longer a reliable skew signal after
   * SPEC-04 redefined `current` as latest-measured, not live agent version.
   */
  const fullyStale =
    !dashLoading &&
    lastMeasuredVersion != null &&
    lastMeasuredVersion !== agent.version;

  const viewCase = viewRunCaseId != null ? (cases ?? []).find((c) => c.id === viewRunCaseId) : null;
  const viewRun = viewCase ? latestRunByCase.get(viewCase.id) : undefined;

  /**
   * Run every case one POST at a time so each card's spinner / metrics refresh
   * tracks the in-flight case. A single batch POST (`{}`) would leave the UI
   * stuck on a global "Running…" with no per-cell signal until the whole
   * response returns. Continues past per-case failures (mirrors server AC-18).
   */
  const handleRunAll = React.useCallback(async () => {
    const ids = (cases ?? []).map((c) => c.id);
    if (ids.length === 0 || runAllActive || runEvals.isPending) return;
    setRunAllActive(true);
    try {
      for (const caseId of ids) {
        try {
          await runEvals.mutateAsync({ case_ids: [caseId] });
        } catch {
          // Keep going — one failed case must not abort the rest of the pass.
        }
      }
    } finally {
      setRunAllActive(false);
    }
  }, [cases, runAllActive, runEvals.isPending, runEvals.mutateAsync]);

  const runningCaseId =
    runEvals.isPending && runEvals.variables?.case_ids?.length === 1
      ? (runEvals.variables.case_ids[0] ?? null)
      : null;

  return (
    <>
      <EvalsTabView
        agent={agent}
        dashboard={dashboard ?? null}
        cases={cases ?? []}
        loading={dashLoading || casesLoading}
        runningAll={runAllActive}
        runningCaseId={runningCaseId}
        hasPreviousVersion={hasPreviousVersion}
        latestRunByCase={latestRunByCase}
        passingCount={passingCount}
        fullyStale={fullyStale}
        lastMeasuredVersion={lastMeasuredVersion}
        onRunAll={() => {
          void handleRunAll();
        }}
        onRunCase={(caseId) => runEvals.mutate({ case_ids: [caseId] })}
        onEditCase={openEdit}
        onDeleteCase={(caseId) => deleteCase.mutate(caseId)}
        onNewCase={openNew}
        onViewRun={setViewRunCaseId}
      />
      {modalOpen && (
        <EvalCaseModal
          agent={agent}
          caseId={editCaseId}
          prefill={prefill}
          onClose={closeModal}
        />
      )}
      {viewCase && viewRun && (
        <EvalRunDetailModal evalCase={viewCase} run={viewRun} onClose={closeRunDetail} />
      )}
    </>
  );
}
