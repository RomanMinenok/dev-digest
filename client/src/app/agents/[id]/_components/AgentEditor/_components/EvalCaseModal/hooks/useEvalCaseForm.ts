"use client";

/**
 * useEvalCaseForm — manages the controlled form state for EvalCaseModal (T21).
 *
 * Ownership rules:
 *  - All editable state (name, diff, expectedOutputText, runOnSave, activeInputTab)
 *    is kept in useState, initialised once from props on mount.
 *  - All derived values (filesInDiff, jsonParseResult, prMeta, offDiffFiles, canSave)
 *    are computed via useMemo — never mirrored into state via useEffect.
 */

import React from "react";
import type { EvalCase, ExpectedFinding } from "@devdigest/shared";
import type { EvalPrefillPayload } from "../../../../../../../../lib/eval-prefill";
import {
  parseExpectedOutput,
  expectationsOffDiff,
  type ParseResult,
} from "../helpers";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type InputTab = "diff" | "files" | "prMeta";

/** Extracted PR metadata shown read-only in the PR meta tab (AC-11). */
export interface PrMeta {
  number: number;
  title: string;
  body: string;
  author: string;
}

export interface EvalCaseFormState {
  // Editable state
  name: string;
  setName: (v: string) => void;
  diff: string;
  setDiff: (v: string) => void;
  expectedOutputText: string;
  setExpectedOutputText: (v: string) => void;
  runOnSave: boolean;
  setRunOnSave: (v: boolean) => void;
  activeInputTab: InputTab;
  setActiveInputTab: (v: InputTab) => void;

  // Derived — computed each render, never useState-mirrored
  filesInDiff: string[];
  jsonParseResult: ParseResult<ExpectedFinding[]>;
  prMeta: PrMeta | null;
  /** Files referenced by expected findings that do not appear in the diff. */
  offDiffFiles: string[];
  /** True when Save should be enabled (AC-7, AC-8, plus non-empty diff guard). */
  canSave: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely extract PR metadata from `input_meta` (typed as unknown). */
function extractPrMeta(inputMeta: unknown): PrMeta | null {
  if (!inputMeta || typeof inputMeta !== "object") return null;
  const meta = inputMeta as Record<string, unknown>;
  if (!meta.pr || typeof meta.pr !== "object") return null;
  const pr = meta.pr as Record<string, unknown>;
  if (typeof pr.number !== "number") return null;
  return {
    number: pr.number,
    title: typeof pr.title === "string" ? pr.title : "",
    body: typeof pr.body === "string" ? pr.body : "",
    author: typeof pr.author === "string" ? pr.author : "",
  };
}

/** Parse file paths from a unified diff (supports both `diff --git` and `+++ b/` headers). */
function filesFromDiff(diff: string): string[] {
  const seen = new Set<string>();
  for (const line of diff.split("\n")) {
    // Prefer the git-style header (same format expectationsOffDiff uses)
    const gitMatch = /^diff --git a\/(.+) b\/.+$/.exec(line);
    if (gitMatch?.[1]) {
      seen.add(gitMatch[1]);
      continue;
    }
    const plusMatch = /^\+\+\+ b\/(.+)$/.exec(line);
    if (plusMatch?.[1] && plusMatch[1] !== "/dev/null") {
      seen.add(plusMatch[1]);
    }
  }
  return [...seen];
}

/** Stringify unknown expected_output as pretty JSON; fallback to empty array. */
function toExpectedText(value: unknown): string {
  if (value === null || value === undefined) return "[]";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[]";
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseEvalCaseFormProps {
  /** Existing case data (edit mode). Null when creating a new case. */
  existingCase: EvalCase | null;
  /** Prefill payload from the "Turn into eval case" action (AC-1). */
  prefill: EvalPrefillPayload | null;
}

export function useEvalCaseForm({
  existingCase,
  prefill,
}: UseEvalCaseFormProps): EvalCaseFormState {
  // ── Editable state — lazy initialisers run once on mount ──────────────────

  const [name, setName] = React.useState<string>(() => {
    if (existingCase) return existingCase.name;
    if (prefill) return prefill.name;
    return "";
  });

  const [diff, setDiff] = React.useState<string>(() => {
    if (existingCase) return existingCase.input_diff;
    if (prefill) return prefill.input_diff;
    return "";
  });

  const [expectedOutputText, setExpectedOutputText] = React.useState<string>(() => {
    if (existingCase) return toExpectedText(existingCase.expected_output);
    if (prefill) return toExpectedText(prefill.expected_output);
    return "[]";
  });

  const [runOnSave, setRunOnSave] = React.useState(false);
  const [activeInputTab, setActiveInputTab] = React.useState<InputTab>("diff");

  // ── Derived values — useMemo, never useEffect-mirrored ───────────────────

  const prMeta = React.useMemo<PrMeta | null>(() => {
    if (prefill) return prefill.input_meta.pr as PrMeta;
    if (existingCase) return extractPrMeta(existingCase.input_meta);
    return null;
  }, [prefill, existingCase]);

  const filesInDiff = React.useMemo(() => filesFromDiff(diff), [diff]);

  const jsonParseResult = React.useMemo(
    () => parseExpectedOutput(expectedOutputText) as ParseResult<ExpectedFinding[]>,
    [expectedOutputText],
  );

  const offDiffFiles = React.useMemo<string[]>(() => {
    if (!diff.trim()) return [];
    if (!jsonParseResult.ok) return [];
    return expectationsOffDiff(jsonParseResult.value, diff).map((e) => e.file);
  }, [diff, jsonParseResult]);

  const canSave = React.useMemo(
    () => name.trim() !== "" && jsonParseResult.ok && diff.trim() !== "",
    [name, jsonParseResult.ok, diff],
  );

  return {
    name,
    setName,
    diff,
    setDiff,
    expectedOutputText,
    setExpectedOutputText,
    runOnSave,
    setRunOnSave,
    activeInputTab,
    setActiveInputTab,
    filesInDiff,
    jsonParseResult,
    prMeta,
    offDiffFiles,
    canSave,
  };
}
