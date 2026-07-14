/* github-urls.ts — build github.com deep-links from data we already hold.
   PR detail has repo full_name (owner/repo), PR number, head sha, and finding
   file/line — enough to open the PR or a file blob at a line range in a new tab. */

const HOST = "https://github.com";

/** Encode a repo-relative path for a URL while keeping "/" separators. */
function encPath(file: string): string {
  return file
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

/** https://github.com/{owner}/{repo}/pull/{number} */
export function githubPrUrl(repoFullName: string, number: number): string {
  return `${HOST}/${repoFullName}/pull/${number}`;
}

/**
 * https://github.com/{owner}/{repo}/blob/{sha}/{file}#L{start}[-L{end}]
 * `sha` pins the link to the PR's head so line numbers stay accurate.
 */
export function githubBlobUrl(
  repoFullName: string,
  sha: string,
  file: string,
  startLine?: number,
  endLine?: number,
): string {
  let url = `${HOST}/${repoFullName}/blob/${sha}/${encPath(file)}`;
  if (startLine != null) {
    url += `#L${startLine}`;
    if (endLine != null && endLine !== startLine) url += `-L${endLine}`;
  }
  return url;
}

/**
 * Build an in-app handoff URL that opens an external target, then returns the
 * user to `returnTo` (the PR page they came from). Used when we want GitHub
 * deep-links to bounce back into the studio without losing place.
 *
 * Example: `/go?next=https://github.com/...&return=/repos/.../pulls/12`
 */
export function externalHandoffUrl(externalUrl: string, returnTo: string): string {
  const params = new URLSearchParams({
    next: externalUrl,
    return: returnTo,
  });
  return `/go?${params.toString()}`;
}

/**
 * Resolve the post-handoff destination. Prefers an explicit `next` (so callers
 * can deep-link straight into GitHub or back into the app); falls back to
 * `return`, then `/`.
 */
export function resolveHandoffTarget(
  next: string | null | undefined,
  returnTo: string | null | undefined,
): string {
  return next || returnTo || "/";
}
