/**
 * Shared "one review session" definition, used by `pulls` (Smart Diff
 * findings, PR-list cost rollup) and `brief` (latest session reviews/agents):
 * a set of timestamped rows belongs to the same session as the newest row if
 * it falls within `SESSION_WINDOW_MS` of it. Multiple agents launched from a
 * single "Run Review" click start within milliseconds of each other (loop
 * inserts), so 60 s safely covers any DB round-trip lag between them.
 *
 * Previously this constant and its filtering logic were redefined
 * independently in `pulls/service.ts`, `pulls/routes.ts`, and
 * `brief/repository.ts` — see `server/INSIGHTS.md`'s "review session defined
 * three times" note. Import from here instead of re-declaring it.
 */
export const SESSION_WINDOW_MS = 60_000;

/**
 * Filters `items` down to those within `SESSION_WINDOW_MS` of the latest
 * timestamp reported by `getTime`. Pure — no I/O, no framework dependency.
 * Returns `[]` for an empty input.
 */
export function selectSessionWindow<T>(items: readonly T[], getTime: (item: T) => number): T[] {
  if (items.length === 0) return [];
  const latestMs = items.reduce((max, item) => Math.max(max, getTime(item)), 0);
  return items.filter((item) => latestMs - getTime(item) <= SESSION_WINDOW_MS);
}
