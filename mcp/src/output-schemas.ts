import { z } from 'zod';

/**
 * Own minimal zod types on the fields we actually consume — deliberately not
 * importing @devdigest/shared (vendor drift risk, server/INSIGHTS.md:30).
 * Leading fields are name/title/file:line/severity; internal uuid is secondary
 * (low-hallucination surface for the model).
 */

export const AgentOut = z.object({
  agent_id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  provider: z.string(),
  model: z.string(),
  enabled: z.boolean(),
});
export type AgentOut = z.infer<typeof AgentOut>;

export const FindingOut = z.object({
  finding_id: z.string(),
  title: z.string(),
  severity: z.string(),
  category: z.string(),
  file: z.string(),
  start_line: z.number().int().nullish(),
  end_line: z.number().int().nullish(),
  suggestion: z.string().nullish(),
  confidence: z.number().nullish(),
});
export type FindingOut = z.infer<typeof FindingOut>;

export const RunResultOut = z.object({
  status: z.enum(['completed', 'running']),
  run_id: z.string(),
  verdict: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  findings_summary: z.string().optional(),
  findings: z.array(FindingOut).optional(),
  poll_after_seconds: z.number().int().optional(),
});
export type RunResultOut = z.infer<typeof RunResultOut>;

export const FindingsPageOut = z.object({
  total: z.number().int(),
  counts_by_severity: z.record(z.string(), z.number().int()),
  page: z.number().int(),
  page_size: z.number().int(),
  verdict: z.string().nullable(),
  findings: z.array(FindingOut),
});
export type FindingsPageOut = z.infer<typeof FindingsPageOut>;

export const ConventionOut = z.object({
  rule: z.string(),
  evidence_path: z.string(),
  evidence_snippet: z.string(),
  confidence: z.number(),
  accepted: z.boolean(),
});
export type ConventionOut = z.infer<typeof ConventionOut>;

export const ConventionsOut = z.object({
  conventions: z.array(ConventionOut),
});
export type ConventionsOut = z.infer<typeof ConventionsOut>;

export const BlastChangedSymbolOut = z.object({
  name: z.string(),
  file: z.string(),
  kind: z.string(),
});
export type BlastChangedSymbolOut = z.infer<typeof BlastChangedSymbolOut>;

export const BlastCallerOut = z.object({
  name: z.string(),
  file: z.string(),
  line: z.number().int(),
});
export type BlastCallerOut = z.infer<typeof BlastCallerOut>;

export const BlastDownstreamOut = z.object({
  symbol: z.string(),
  callers: z.array(BlastCallerOut),
  endpoints: z.array(z.string()),
  crons: z.array(z.string()),
});
export type BlastDownstreamOut = z.infer<typeof BlastDownstreamOut>;

export const BlastRadiusOut = z.object({
  status: z.enum(['full', 'partial', 'degraded']),
  changed_symbols: z.array(BlastChangedSymbolOut),
  downstream: z.array(BlastDownstreamOut),
  summary: z.string(),
});
export type BlastRadiusOut = z.infer<typeof BlastRadiusOut>;
