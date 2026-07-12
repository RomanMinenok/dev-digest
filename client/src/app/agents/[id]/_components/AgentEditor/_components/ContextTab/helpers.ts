/* helpers.ts — pure ordering/membership/token logic for the agent Context tab.
   Kept I/O-free so it is trivially unit-testable and reusable (mirrors
   SkillsTab/helpers.ts's structure for a string-path-keyed row instead of a
   Skill-object-keyed one). */
import type { ContextDoc } from "@devdigest/shared";

/**
 * Deterministic token-estimate heuristic — MUST mirror the server's
 * `estimateTokens` (server/src/modules/project-context/helpers.ts):
 * ~4 bytes per token, `Math.ceil` so a nonzero-size doc never rounds to 0.
 * Duplicated here (not imported) because the client has no access to the
 * server module; keep both in sync if the heuristic ever changes.
 */
const BYTES_PER_TOKEN_ESTIMATE = 4;

export function estimateTokens(sizeBytes: number): number {
  return Math.ceil(sizeBytes / BYTES_PER_TOKEN_ESTIMATE);
}

/**
 * A discovered-or-stale doc plus whether it is currently attached to the
 * agent. `doc` is `null` when the path is attached but no longer present in
 * the fresh discovery list (AC-24 "stale" case) — the row still renders and
 * stays toggleable, it just has no `size_bytes`/`used_by_count` to show.
 */
export interface ContextRow {
  path: string;
  linked: boolean;
  doc: ContextDoc | null;
}

/**
 * Build the displayed row order: attached paths first (in their persisted
 * order), each matched against the fresh discovery list (or `null` if
 * stale — AC-24), then every remaining discovered doc appended (in
 * discovery order).
 */
export function buildRows(docs: ContextDoc[], attachedPaths: string[]): ContextRow[] {
  const byPath = new Map(docs.map((d) => [d.path, d]));
  const attachedSet = new Set(attachedPaths);

  const linkedRows: ContextRow[] = attachedPaths.map((path) => ({
    path,
    linked: true,
    doc: byPath.get(path) ?? null,
  }));
  const unlinkedRows: ContextRow[] = docs
    .filter((d) => !attachedSet.has(d.path))
    .map((d) => ({ path: d.path, linked: false, doc: d }));

  return [...linkedRows, ...unlinkedRows];
}

/** The ordered paths of the attached rows — the payload sent to the server. */
export function linkedPaths(rows: ContextRow[]): string[] {
  return rows.filter((r) => r.linked).map((r) => r.path);
}

/** Toggle a row's membership, re-grouping so linked rows stay first. */
export function toggleMembership(rows: ContextRow[], path: string): ContextRow[] {
  const next = rows.map((r) => (r.path === path ? { ...r, linked: !r.linked } : r));
  return regroup(next);
}

/**
 * Reorder the LINKED rows by moving the linked row at `from` to `to`.
 * Indices are positions within the linked sub-list (0-based). Unlinked rows
 * are untouched and stay appended after the linked block.
 */
export function reorderLinked(rows: ContextRow[], from: number, to: number): ContextRow[] {
  const linked = rows.filter((r) => r.linked);
  const unlinked = rows.filter((r) => !r.linked);
  if (from < 0 || to < 0 || from >= linked.length || to >= linked.length || from === to) {
    return rows;
  }
  const moved = linked.splice(from, 1)[0];
  if (!moved) return rows;
  linked.splice(to, 0, moved);
  return [...linked, ...unlinked];
}

/** Apply a case-insensitive path filter (empty query = all). */
export function filterRows(rows: ContextRow[], query: string): ContextRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.path.toLowerCase().includes(q));
}

/**
 * Live token total for the currently-attached set (AC-10) — sums the
 * deterministic estimate over every attached row that still resolves to a
 * real discovered doc (`doc != null`); stale rows (no `size_bytes` to read)
 * are excluded from the sum, matching the server route's own
 * `attachedPaths`-gated total (routes.ts).
 */
export function attachedTokenTotal(rows: ContextRow[]): number {
  return rows
    .filter((r) => r.linked && r.doc)
    .reduce((sum, r) => sum + estimateTokens(r.doc!.size_bytes), 0);
}

/** Re-group rows so linked ones (in current relative order) precede unlinked. */
function regroup(rows: ContextRow[]): ContextRow[] {
  const linked = rows.filter((r) => r.linked);
  const unlinked = rows.filter((r) => !r.linked);
  return [...linked, ...unlinked];
}

/** Locale-formatted token count, matching the Project Context list page's footer. */
export function formatTokenCount(n: number): string {
  return n.toLocaleString("en-US");
}
