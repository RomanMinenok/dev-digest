import type { FindingRecord, ReviewRecord } from "@devdigest/shared";

/**
 * Contract-gap workaround: `SmartDiffFile.finding_lines` carries line numbers
 * only (no severity/id/range). Cross-reference against the already-fetched
 * findings list (which does carry `start_line`/`end_line`) by file + inclusive
 * line range, so the severity stripe covers the finding's whole span, not just
 * its first line. Callers render the badge only where `line === start_line`.
 */
export function findingForLine(
  findings: FindingRecord[],
  path: string,
  line: number,
): FindingRecord | undefined {
  return findings.find((f) => f.file === path && line >= f.start_line && line <= f.end_line);
}

const SESSION_WINDOW_MS = 60_000;

/**
 * Client-side mirror of the server's `assembleSmartDiff` session-window rule
 * (Decision 2): "findings from the last review" = all reviews within 60s of
 * the most recent `created_at`, flattened. Needed here because `FindingRecord`
 * has no `created_at` of its own — only `ReviewRecord` does — so the filter
 * must run on reviews before flattening to findings. Without this, the
 * per-line stripe/badge in `SmartDiffViewer` would cross-reference stale
 * findings from old review runs, disagreeing with the server-computed
 * `finding_lines` (which already respects the window) used for the
 * collapsed-row indicator dot.
 */
export function sessionWindowFindings(reviews: ReviewRecord[]): FindingRecord[] {
  const latestMs = reviews.reduce((max, r) => Math.max(max, new Date(r.created_at).getTime()), 0);
  return reviews
    .filter((r) => latestMs - new Date(r.created_at).getTime() <= SESSION_WINDOW_MS)
    .flatMap((r) => r.findings);
}
