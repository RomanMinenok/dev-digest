/**
 * Pure derived multi-run status (SPEC-05, T-06).
 *
 * No I/O, no framework imports — a member is any shape exposing a nullable
 * `status` string, so this stays decoupled from the Drizzle row shape.
 */

export type MultiRunStatus = 'running' | 'done' | 'partial' | 'failed';

interface StatusMember {
  status: string | null;
}

/**
 * Derive the overall status of a multi-agent run from its member runs.
 *
 * Rules:
 * - `running` — while any member is still `'running'`.
 * - `done` — every member is `'done'`.
 * - `partial` — every member is terminal and at least one succeeded
 *   (`'done'`) and at least one did not.
 * - `failed` — every member is terminal and none succeeded. This also
 *   covers zero members (a multi-run with no members cannot be `done`).
 *
 * Any status value that is not literally `'running'` or `'done'` is treated
 * as failed (fail-closed) — this folds `'cancelled'` and reaped orphan rows
 * (rewritten to `'failed'` on boot) into "failed" without a distinct branch,
 * and ensures a future/unknown status never silently reads as success or as
 * still-running.
 */
export function deriveStatus(members: StatusMember[]): MultiRunStatus {
  if (members.length === 0) {
    return 'failed';
  }

  const anyRunning = members.some((m) => m.status === 'running');
  if (anyRunning) {
    return 'running';
  }

  const doneCount = members.filter((m) => m.status === 'done').length;

  if (doneCount === members.length) {
    return 'done';
  }

  if (doneCount > 0) {
    return 'partial';
  }

  return 'failed';
}
