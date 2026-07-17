import type { Severity } from '@devdigest/shared';
import type { LocationGroup } from './types.js';

/**
 * Pure cell builder for the "Findings by location" matrix (SPEC-05, T-08 —
 * AC-33, AC-34, AC-35, AC-36; AC-37 amended 2026-07-17 for progressive render).
 *
 * No I/O, no framework imports — a member is any shape exposing an `agentId`
 * and a nullable `status` string, decoupled from the Drizzle row shape (same
 * approach as `status.ts`'s `StatusMember`).
 */

/**
 * Severity ordering, most-to-least severe. Never rely on string sort here —
 * alphabetically `SUGGESTION` > `CRITICAL`, which is the wrong order.
 */
const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 3,
  WARNING: 2,
  SUGGESTION: 1,
};

interface CellMember {
  agentId: string;
  status: string | null;
}

/**
 * One matrix cell — a four-member discriminated union, not a string with
 * optional extras. There is deliberately no rationale/explanation field on
 * the `did_not_flag` variant (AC-36): that silence is data, and the spec
 * forbids reserving space for an explanation that will never exist.
 * `pending` is the truthful mid-run state — never collapse it into
 * `did_not_flag` or `failed` (those would rewrite themselves when the agent
 * finishes).
 */
export type Cell =
  | { state: 'severity'; agentId: string; severity: Severity }
  | { state: 'did_not_flag'; agentId: string }
  | { state: 'failed'; agentId: string }
  | { state: 'pending'; agentId: string };

/**
 * Build one cell per member agent of the multi-run, in the members' order —
 * the same order as the lanes/tabs, so a reader never has to re-map columns
 * per row.
 *
 * Per member:
 * - One or more findings from that agent in this group ⇒ `severity`, using
 *   the **highest** severity among them (AC-35) — never the first/last one
 *   encountered.
 * - No findings from that agent AND its run reached a terminal, successful
 *   state (`'done'`) ⇒ `did_not_flag`. This silence is the whole point of
 *   running more than one agent — it must never be conflated with `failed`.
 * - Still `'running'` with no findings yet ⇒ `pending` (progressive matrix;
 *   must not read as silence or failure).
 * - Anything else — `'failed'`, `'cancelled'`, a reaped orphan — ⇒ `failed`.
 *   A member that never got to have an opinion must never read as silent
 *   agreement.
 *
 * Grounding-gate-dropped findings never reach this function's inputs — an
 * agent whose only findings were dropped by the grounding gate correctly
 * reads `did_not_flag` here, by construction (Non-goal, not handled here).
 */
export function buildCells(group: LocationGroup, members: CellMember[]): Cell[] {
  return members.map((member): Cell => {
    const memberFindings = group.findings.filter((af) => af.agentId === member.agentId);

    if (memberFindings.length > 0) {
      const highest = memberFindings.reduce((best, af) =>
        SEVERITY_RANK[af.finding.severity] > SEVERITY_RANK[best.finding.severity] ? af : best,
      );
      return { state: 'severity', agentId: member.agentId, severity: highest.finding.severity };
    }

    if (member.status === 'done') {
      return { state: 'did_not_flag', agentId: member.agentId };
    }

    if (member.status === 'running') {
      return { state: 'pending', agentId: member.agentId };
    }

    return { state: 'failed', agentId: member.agentId };
  });
}
