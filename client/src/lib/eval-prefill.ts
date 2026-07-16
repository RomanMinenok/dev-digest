/**
 * eval-prefill.ts — one-shot sessionStorage hand-off from FindingCard
 * (PR page) to AgentEditor › Evals tab.
 *
 * Client-only: must never be imported from a Server Component.
 * The SSR guard (`typeof window === "undefined"`) ensures no
 * `sessionStorage` reference is evaluated during Next.js SSR.
 */

const PREFILL_KEY = "devdigest:eval-prefill";

/** Minimal PR summary written into `input_meta.pr` at capture time. */
export interface EvalPrefillPr {
  number: number;
  title: string;
  body: string;
  author: string;
}

/** Source IDs that let the server re-resolve the frozen enrichment block. */
export interface EvalPrefillSource {
  finding_id: string;
  review_id: string;
  run_id: string;
  pr_id: string;
}

/**
 * The payload written by `Turn into eval case` (T18) and consumed by the
 * EvalCaseModal (T20). No `repoId` — the server resolves enrichment from
 * `source` alone (spec T11).
 *
 * `expected_output` carries the pre-built expected-finding array derived from
 * the finding's accept/dismiss decision (AC-2: dismissed → []; AC-3: accepted
 * or undecided → one-element array). The modal pre-fills the JSON editor with
 * this value.
 */
export interface EvalPrefillPayload {
  agentId: string;
  name: string;
  input_diff: string;
  input_files: unknown;
  input_meta: {
    pr: EvalPrefillPr;
    source: EvalPrefillSource;
  };
  expected_output: unknown;
}

/**
 * Persist a prefill payload into `sessionStorage`.
 * No-op when called during SSR (window is undefined).
 */
export function writeEvalPrefill(payload: EvalPrefillPayload): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PREFILL_KEY, JSON.stringify(payload));
}

/**
 * Read and immediately clear the prefill payload.
 * Returns `null` when called during SSR, when no payload is stored,
 * or when the stored value fails to parse.
 * One-shot: a plain revisit to `?tab=evals` will not reopen the modal.
 */
export function readAndClearEvalPrefill(): EvalPrefillPayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PREFILL_KEY);
  if (raw === null) return null;
  sessionStorage.removeItem(PREFILL_KEY);
  try {
    return JSON.parse(raw) as EvalPrefillPayload;
  } catch {
    return null;
  }
}
