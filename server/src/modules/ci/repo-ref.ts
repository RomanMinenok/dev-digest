import type { RepoRef } from '@devdigest/shared';

/** Parse `owner/name` into a `RepoRef`, or `null` when the shape is invalid. */
export function parseRepoRef(fullName: string): RepoRef | null {
  const slash = fullName.indexOf('/');
  if (slash <= 0 || slash >= fullName.length - 1) return null;
  return { owner: fullName.slice(0, slash), name: fullName.slice(slash + 1) };
}
