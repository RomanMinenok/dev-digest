import { z } from 'zod';

/**
 * PR Brief building blocks: Intent, Blast radius, Risks, PR History,
 * Smart Diff. Composed into PrBrief.
 */

// ---- Intent ----
export const Intent = z.object({
  intent: z.string(),
  in_scope: z.array(z.string()),
  out_of_scope: z.array(z.string()),
});
export type Intent = z.infer<typeof Intent>;

export const IntentSource = z.object({
  type: z.enum(['pr_body', 'linked_issue', 'repo_md', 'pr_md', 'external_url']),
  ref: z.string(),
  included: z.boolean(),
});
export type IntentSource = z.infer<typeof IntentSource>;

export const PrIntent = Intent.extend({
  pr_id: z.string(),
  model: z.string().nullish(),
  head_sha: z.string().nullish(),
  updated_at: z.string().nullish(),
  sources: z.array(IntentSource).nullish(),
});
export type PrIntent = z.infer<typeof PrIntent>;

// ---- Blast radius ----
export const ChangedSymbol = z.object({
  name: z.string(),
  file: z.string(),
  kind: z.string(),
});
export type ChangedSymbol = z.infer<typeof ChangedSymbol>;

export const BlastCaller = z.object({
  name: z.string(),
  file: z.string(),
  line: z.number().int(),
});
export type BlastCaller = z.infer<typeof BlastCaller>;

export const DownstreamImpact = z.object({
  symbol: z.string(),
  callers: z.array(BlastCaller),
  endpoints_affected: z.array(z.string()),
  crons_affected: z.array(z.string()),
});
export type DownstreamImpact = z.infer<typeof DownstreamImpact>;

export const BlastStatus = z.enum(['full', 'partial', 'degraded']);
export type BlastStatus = z.infer<typeof BlastStatus>;

export const BlastRadius = z.object({
  changed_symbols: z.array(ChangedSymbol),
  downstream: z.array(DownstreamImpact),
  status: BlastStatus,
  summary: z.string(),
});
export type BlastRadius = z.infer<typeof BlastRadius>;

// ---- Risks ----
export const RiskSeverity = z.enum(['high', 'medium', 'low']);
export type RiskSeverity = z.infer<typeof RiskSeverity>;

/** File+line deep-link target for a Risk Area (mirrors ReviewFocusItem's path/lines). */
export const RiskFileRef = z.object({
  path: z.string(),
  start_line: z.number().int(),
  end_line: z.number().int().optional(),
});
export type RiskFileRef = z.infer<typeof RiskFileRef>;

export const Risk = z.object({
  kind: z.string(),
  title: z.string(),
  explanation: z.string(),
  severity: RiskSeverity,
  file_refs: z.array(RiskFileRef),
});
export type Risk = z.infer<typeof Risk>;

export const Risks = z.object({
  risks: z.array(Risk),
});
export type Risks = z.infer<typeof Risks>;

// ---- PR History ----
export const PrHistoryItem = z.object({
  pr_number: z.number().int(),
  title: z.string(),
  merged_at: z.string(),
  author: z.string(),
  files_overlap: z.array(z.string()),
  notes: z.string(),
});
export type PrHistoryItem = z.infer<typeof PrHistoryItem>;

export const PrHistory = z.object({
  history: z.array(PrHistoryItem),
});
export type PrHistory = z.infer<typeof PrHistory>;

// ---- Smart Diff ----
export const SmartDiffRole = z.enum(['core', 'wiring', 'boilerplate']);
export type SmartDiffRole = z.infer<typeof SmartDiffRole>;

export const SmartDiffFile = z.object({
  path: z.string(),
  pseudocode_summary: z.string().nullish(),
  additions: z.number().int(),
  deletions: z.number().int(),
  finding_lines: z.array(z.number().int()),
});
export type SmartDiffFile = z.infer<typeof SmartDiffFile>;

export const SmartDiffGroup = z.object({
  role: SmartDiffRole,
  files: z.array(SmartDiffFile),
});
export type SmartDiffGroup = z.infer<typeof SmartDiffGroup>;

export const ProposedSplit = z.object({
  name: z.string(),
  files: z.array(z.string()),
});
export type ProposedSplit = z.infer<typeof ProposedSplit>;

export const SmartDiff = z.object({
  groups: z.array(SmartDiffGroup),
  split_suggestion: z.object({
    too_big: z.boolean(),
    total_lines: z.number().int(),
    proposed_splits: z.array(ProposedSplit),
  }),
});
export type SmartDiff = z.infer<typeof SmartDiff>;

// ---- Review focus ----
export const RiskLevel = z.enum(['critical', 'high', 'medium', 'low']);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const ReviewFocusItem = z.object({
  path: z.string(),
  start_line: z.number().int(),
  end_line: z.number().int().optional(),
  description: z.string(),
  severity: RiskSeverity,
});
export type ReviewFocusItem = z.infer<typeof ReviewFocusItem>;

// ---- Composed PR Brief (pr_brief.json) ----
export const PrBrief = z.object({
  intent: Intent,
  blast: BlastRadius,
  risks: Risks,
  history: PrHistory,
  what: z.string(),
  why: z.string(),
  risk_level: RiskLevel,
  review_focus: z.array(ReviewFocusItem).default([]),
  tokens_in: z.number().nullable(),
  tokens_out: z.number().nullable(),
  cost_usd: z.number().nullable(),
});
export type PrBrief = z.infer<typeof PrBrief>;
