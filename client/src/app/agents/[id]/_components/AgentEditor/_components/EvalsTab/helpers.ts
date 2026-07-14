import { ExpectedFinding, type EvalRunRecord } from "@devdigest/shared";

/**
 * Soft-parse `expected_output` for display. Invalid/missing → `[]` so the
 * list can still render badges + expected counts without crashing on bad JSON
 * shapes that somehow reached the wire.
 */
export function parseExpectedFindings(raw: unknown): ExpectedFinding[] {
  if (!Array.isArray(raw)) return [];
  const out: ExpectedFinding[] = [];
  for (const item of raw) {
    const parsed = ExpectedFinding.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** Count findings in a run's `actual_output` (kept post-grounding set). */
export function countActualFindings(raw: unknown): number {
  return Array.isArray(raw) ? raw.length : 0;
}

/**
 * Unique `SEVERITY · category` labels for the case badges. Empty expected
 * yields no labels — the caller renders the `empty []` placeholder instead.
 */
export function expectedBadgeLabels(expected: ExpectedFinding[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const e of expected) {
    const label = `${e.severity} · ${e.category}`;
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

/** True when a case's latest run scored a different agent config than `agentVersion`. */
export function isRunStaleForAgent(
  run: EvalRunRecord,
  agentVersion: number,
): boolean {
  return run.agent_version !== agentVersion;
}

/**
 * Highest `agent_version` among the given runs, or `null` when none exist.
 * Used for "last measured on v{M}" copy when the current agent version has no runs.
 */
export function lastMeasuredAgentVersion(
  runs: Iterable<EvalRunRecord | undefined | null>,
): number | null {
  let max: number | null = null;
  for (const r of runs) {
    if (r == null) continue;
    if (max === null || r.agent_version > max) max = r.agent_version;
  }
  return max;
}
