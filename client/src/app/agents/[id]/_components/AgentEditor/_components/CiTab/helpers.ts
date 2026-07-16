import type { CiTarget } from "@devdigest/shared";

/** "2026-05-29T09:14:00.000Z" → "4m ago" (matches mock 02-agent-ci-tab.png). */
export function formatRelativeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return `${weeks}w ago`;
}

/** https://github.com/owner/repo */
export function githubRepoUrl(repo: string): string {
  return `https://github.com/${repo}`;
}

/** Whether a CI target uses the GitHub Actions affordance in the row. */
export function targetUsesGitHubIcon(target: CiTarget): boolean {
  return target === "gha";
}
