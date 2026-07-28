"use client";

/**
 * useExportWizard — client-side wizard state for Export to CI (T30).
 * Multi-field wizard state lives in a reducer, not scattered useState calls.
 */

import React from "react";
import type { CiTarget } from "@devdigest/shared";
import type { WizardStepIndex } from "../constants";

export interface ExportWizardState {
  step: WizardStepIndex;
  target: CiTarget;
  /** Manual workflow edits from Preview (Decision 4); cleared on Configure regen. */
  workflowOverride: string | null;
  /** Defaults for later steps (T32); included now so the reducer owns full export input. */
  postAs: "github_review" | "pr_comment" | "none";
  triggers: string[];
  base: string;
}

const INITIAL_STATE: ExportWizardState = {
  step: 0,
  target: "gha",
  workflowOverride: null,
  postAs: "github_review",
  triggers: ["opened", "synchronize"],
  base: "main",
};

type ExportWizardAction =
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "RESET" }
  | { type: "SET_TARGET"; target: CiTarget }
  | { type: "SET_WORKFLOW_OVERRIDE"; workflowOverride: string | null }
  | { type: "SET_TRIGGERS"; triggers: string[] }
  | { type: "SET_POST_AS"; postAs: ExportWizardState["postAs"] };

function clampStep(step: number): WizardStepIndex {
  return Math.max(0, Math.min(step, 3)) as WizardStepIndex;
}

function reducer(state: ExportWizardState, action: ExportWizardAction): ExportWizardState {
  switch (action.type) {
    case "NEXT":
      return { ...state, step: clampStep(state.step + 1) };
    case "BACK":
      return { ...state, step: clampStep(state.step - 1) };
    case "RESET":
      return INITIAL_STATE;
    case "SET_TARGET":
      if (action.target !== "gha") return state;
      return { ...state, target: action.target };
    case "SET_WORKFLOW_OVERRIDE":
      return { ...state, workflowOverride: action.workflowOverride };
    case "SET_TRIGGERS":
      return { ...state, triggers: action.triggers };
    case "SET_POST_AS":
      return { ...state, postAs: action.postAs };
    default:
      return state;
  }
}

export function useExportWizard() {
  const [state, dispatch] = React.useReducer(reducer, INITIAL_STATE);

  const reset = React.useCallback(() => dispatch({ type: "RESET" }), []);
  const next = React.useCallback(() => dispatch({ type: "NEXT" }), []);
  const back = React.useCallback(() => dispatch({ type: "BACK" }), []);
  const setTarget = React.useCallback(
    (target: CiTarget) => dispatch({ type: "SET_TARGET", target }),
    [],
  );
  const setWorkflowOverride = React.useCallback(
    (workflowOverride: string | null) =>
      dispatch({ type: "SET_WORKFLOW_OVERRIDE", workflowOverride }),
    [],
  );
  const setTriggers = React.useCallback(
    (triggers: string[]) => dispatch({ type: "SET_TRIGGERS", triggers }),
    [],
  );
  const setPostAs = React.useCallback(
    (postAs: ExportWizardState["postAs"]) => dispatch({ type: "SET_POST_AS", postAs }),
    [],
  );

  return {
    state,
    reset,
    next,
    back,
    setTarget,
    setWorkflowOverride,
    setTriggers,
    setPostAs,
  };
}
