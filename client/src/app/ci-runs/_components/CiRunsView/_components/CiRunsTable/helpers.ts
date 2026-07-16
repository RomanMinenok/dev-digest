import type { CiRun } from "@devdigest/shared";

/** True when the run has no ingested artifact — duration/findings/cost show dashes (AC-39). */
export function hasArtifact(run: CiRun): boolean {
  return run.run_id != null;
}

/** Severity counts are unavailable when every count field is null. */
export function hasFindingCounts(run: CiRun): boolean {
  return run.critical != null || run.warning != null || run.suggestion != null;
}

export function prLabel(run: CiRun): string {
  if (run.pr_number == null) return "—";
  return `#${run.pr_number}`;
}
