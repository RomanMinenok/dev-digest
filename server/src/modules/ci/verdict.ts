import type { CiFailOn, CiRunStatus } from '@devdigest/shared';
import { gateTriggeredFromCounts, type SeverityCounts } from '@devdigest/reviewer-core';

function totalFindings(counts: SeverityCounts): number {
  return counts.critical + counts.warning + counts.suggestion;
}

/**
 * Derive a CI run's persisted status from grounded finding counts and the
 * agent's `ci_fail_on` gate — never from a model-reported verdict (AC-34).
 *
 * Zero findings → `no_findings` (valid review, e.g. all dropped by grounding).
 * Gate tripped → `changes_requested`; findings present but gate clear → `succeeded`.
 */
export function ciRunStatus(counts: SeverityCounts, failOn: CiFailOn): CiRunStatus {
  if (totalFindings(counts) === 0) return 'no_findings';
  if (gateTriggeredFromCounts(counts, failOn)) return 'changes_requested';
  return 'succeeded';
}
