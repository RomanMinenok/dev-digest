import { z } from 'zod';
import { Finding, Severity, Verdict } from './findings.js';
import { Intent, SmartDiff } from './brief.js';

/**
 * A2 — Review-Core API surface contracts. These extend the core
 * Review/Finding/Intent/SmartDiff contracts with the persisted/transport shapes
 * the reviewer endpoints return. A2 owns this file; the barrel re-exports it.
 *
 * Distinct from `Finding` (the raw LLM-output unit): `FindingRecord` adds the
 * persisted row identity + action timestamps so the UI can render accept/dismiss
 * state and the `review_id` it belongs to.
 */

export const FindingRecord = Finding.extend({
  review_id: z.string(),
  accepted_at: z.string().nullable(),
  dismissed_at: z.string().nullable(),
});
export type FindingRecord = z.infer<typeof FindingRecord>;

/** A persisted review with its kept findings + grounding summary. */
export const ReviewRecord = z.object({
  id: z.string(),
  pr_id: z.string(),
  agent_id: z.string().nullable(),
  run_id: z.string().nullable(),
  agent_name: z.string().nullish(),
  kind: z.enum(['summary', 'review']),
  verdict: Verdict.nullable(),
  summary: z.string().nullable(),
  score: z.number().int().nullable(),
  model: z.string().nullable(),
  grounding: z.string().nullish(),
  created_at: z.string(),
  findings: z.array(FindingRecord),
});
export type ReviewRecord = z.infer<typeof ReviewRecord>;

/**
 * Response of `POST /pulls/:id/review`. Each requested agent produces a run that
 * streams over SSE at `/runs/:runId/events`; clients subscribe per run. The
 * persisted reviews are also returned once the (synchronous) run completes.
 */
export const ReviewRunTarget = z.object({
  run_id: z.string(),
  agent_id: z.string(),
  agent_name: z.string(),
});
export type ReviewRunTarget = z.infer<typeof ReviewRunTarget>;

export const ReviewRunResponse = z.object({
  pr_id: z.string(),
  runs: z.array(ReviewRunTarget),
  reviews: z.array(ReviewRecord),
});
export type ReviewRunResponse = z.infer<typeof ReviewRunResponse>;

/** Intent persisted for a PR (the Intent plus the pr_id it scopes). */
export const PrIntentRecord = Intent.extend({ pr_id: z.string() });
export type PrIntentRecord = z.infer<typeof PrIntentRecord>;

/** Smart-diff response for a PR (the SmartDiff). */
export const SmartDiffResponse = SmartDiff;
export type SmartDiffResponse = z.infer<typeof SmartDiffResponse>;

/**
 * Multi-agent review (SPEC-05, T-09). Wire (snake_case) mirrors of the pure
 * domain shapes in `modules/multi-agent/{types,cells,status,estimate}.ts` —
 * see those files' headers for the rules these shapes carry (grouping is
 * coordinates-only, cells are a 3-state union, estimates are nullable-not-zero).
 * Nothing here is persisted (AC-31); it is assembled on every read.
 */

/**
 * One matrix cell — mirrors the `Cell` discriminated union in
 * `modules/multi-agent/cells.ts`. Kept as a real discriminated union on the
 * wire too: the three states (`severity` / `did_not_flag` / `failed`) must
 * never collapse into a single string with optional extras.
 */
export const MultiAgentCell = z.discriminatedUnion('state', [
  z.object({ state: z.literal('severity'), agent_id: z.string(), severity: Severity }),
  z.object({ state: z.literal('did_not_flag'), agent_id: z.string() }),
  z.object({ state: z.literal('failed'), agent_id: z.string() }),
]);
export type MultiAgentCell = z.infer<typeof MultiAgentCell>;

/** A finding as it appears inside a location group — carries its producing agent's id (AC-32). */
export const MultiAgentGroupFinding = Finding.extend({
  agent_id: z.string(),
});
export type MultiAgentGroupFinding = z.infer<typeof MultiAgentGroupFinding>;

/**
 * One location group of the "Findings by location" matrix. `matched` /
 * `divergent` / `agreed` are the classification flags `similarity.ts`
 * computes (AC-38..AC-43) — the client consumes them as-is and must never
 * recompute Jaccard itself.
 */
export const MultiAgentGroup = z.object({
  file: z.string(),
  start_line: z.number().int(),
  end_line: z.number().int(),
  label: z.string(),
  findings: z.array(MultiAgentGroupFinding),
  cells: z.array(MultiAgentCell),
  matched: z.boolean(),
  divergent: z.boolean(),
  agreed: z.boolean(),
});
export type MultiAgentGroup = z.infer<typeof MultiAgentGroup>;

/** Derived overall status of a multi-agent run — mirrors `MultiRunStatus` in `modules/multi-agent/status.ts`. */
export const MultiAgentRunStatus = z.enum(['running', 'done', 'partial', 'failed']);
export type MultiAgentRunStatus = z.infer<typeof MultiAgentRunStatus>;

/**
 * One member (agent run) of a multi-agent run. `agent_id`/`agent_name` are
 * nullable — `agent_runs.agent_id` is `on delete set null` (`db/schema/runs.ts:15`),
 * so a deleted agent must still render as a historical member, not disappear.
 */
export const MultiAgentMember = z.object({
  agent_id: z.string().nullable(),
  agent_name: z.string().nullable(),
  status: z.string().nullable(),
  score: z.number().int().nullable(),
  duration_ms: z.number().int().nullable(),
  cost_usd: z.number().nullable(),
  error: z.string().nullable(),
  run_id: z.string(),
  findings: z.array(FindingRecord),
});
export type MultiAgentMember = z.infer<typeof MultiAgentMember>;

/** `GET /pulls/:id/multi-agent-run` response — the latest multi-agent run for a PR. */
export const MultiAgentRunView = z.object({
  id: z.string(),
  pr_id: z.string(),
  ran_at: z.string(),
  status: MultiAgentRunStatus,
  members: z.array(MultiAgentMember),
  groups: z.array(MultiAgentGroup),
});
export type MultiAgentRunView = z.infer<typeof MultiAgentRunView>;

/**
 * Per-agent duration/cost estimate from recent completed-run history
 * (AC-9..AC-11). `duration_ms`/`cost_usd` are nullable, never `0` — `null`
 * means "no history"/"unknown price" and `0` is a legitimate value; they must
 * not share a representation (see `modules/multi-agent/estimate.ts`).
 */
export const AgentEstimate = z.object({
  agent_id: z.string(),
  duration_ms: z.number().int().nullable(),
  cost_usd: z.number().nullable(),
});
export type AgentEstimate = z.infer<typeof AgentEstimate>;

/**
 * Selection-level rollup across multiple agents' estimates — mirrors
 * `EstimateTotals` in `modules/multi-agent/estimate.ts`. `approx` is data,
 * not a UI re-derivation: `true` renders with `≈`, `false` with `≥`.
 */
export const EstimateTotals = z.object({
  duration_ms: z.number().int().nullable(),
  cost_usd: z.number().nullable(),
  approx: z.boolean(),
});
export type EstimateTotals = z.infer<typeof EstimateTotals>;
