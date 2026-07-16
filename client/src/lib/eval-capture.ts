/**
 * eval-capture.ts — helpers for building eval-case inputs from PR findings.
 *
 * These functions are shared between FindingsPanel (PR review page) and any
 * other cross-route consumer that needs to compose an eval case from a live
 * finding. They are intentionally kept separate from EvalCaseModal's private
 * helpers (parseExpectedOutput, expectationsOffDiff) which remain route-local.
 *
 * Client-only; not safe to import from Server Components.
 */

import type { FindingRecord, PrFile } from "@devdigest/shared";

// ---------------------------------------------------------------------------
// slugifyTitle
// ---------------------------------------------------------------------------

/**
 * Convert an arbitrary string to a URL-safe kebab-case slug suitable for use
 * as an eval-case name. Lowercases, replaces non-alphanumeric runs with a
 * single hyphen, and trims leading/trailing hyphens.
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// sliceDiffToFile
// ---------------------------------------------------------------------------

/**
 * Given a full list of PR files (with their patches) and a file path, return
 * the unified-diff text for **that file only**, in the format
 * `parseUnifiedDiff` expects:
 *
 *   diff --git a/<path> b/<path>
 *   --- a/<path>
 *   +++ b/<path>
 *   <patch>
 *
 * Returns `''` when the file is absent from the list or has no patch.
 * Never throws (spec edge case / AC-4).
 */
export function sliceDiffToFile(files: PrFile[], path: string): string {
  try {
    const file = files.find((f) => f.path === path);
    if (!file || !file.patch) return "";
    const parts = [
      `diff --git a/${file.path} b/${file.path}`,
      `--- a/${file.path}`,
      `+++ b/${file.path}`,
      file.patch,
    ];
    return parts.join("\n");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// expectedFromFinding
// ---------------------------------------------------------------------------

/**
 * Build the expected-output array for an eval case prefilled from a finding.
 *
 * - Dismissed finding (AC-2) → `[]` (the eval expects the agent to produce
 *   *nothing* for that file/line — a true-negative test).
 * - Accepted **or** undecided finding (AC-3) → one-element array with the
 *   six matching coordinates: severity, category, title, file, start_line,
 *   end_line — the full line range, not just its start (a missing end_line
 *   would collapse the match to a single point, AC-21).
 */
export function expectedFromFinding(
  finding: Pick<
    FindingRecord,
    "dismissed_at" | "severity" | "category" | "title" | "file" | "start_line" | "end_line"
  >,
): Array<{
  severity: string;
  category: string;
  title: string;
  file: string;
  start_line: number;
  end_line: number;
}> {
  if (finding.dismissed_at) return [];
  return [
    {
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
      file: finding.file,
      start_line: finding.start_line,
      end_line: finding.end_line,
    },
  ];
}
