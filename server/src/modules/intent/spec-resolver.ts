import type { GitClient, IntentSource, IssueMeta, PrDetail, RepoRef } from '@devdigest/shared';
import { safeFetch } from '../../adapters/http/safe-fetch.js';

/**
 * Gathers narrative "spec" context for the Intent Layer classifier — repo/PR
 * markdown, the linked issue body, and allowlisted external URLs referenced
 * in the PR body (docs/plan/intent_layer_plan.md §0.5, Phase 3). Impure
 * (reads the clone + hits the network) but receives ALL its dependencies as
 * plain params — no `container` import, mirroring `modules/conventions/extractor.ts`
 * (`ExtractInput` object) so the service layer stays the only place that
 * touches the DI container.
 *
 * Never throws: every unresolved/failed source is still recorded as an
 * `IntentSource` with `included: false` (graceful degradation — plan §0).
 */

/** Total spec-context budget in bytes, per the plan's ~30 KB cap. */
const TOTAL_BUDGET_BYTES = 30 * 1024;

const TRUNCATION_MARKER = '\n\n[...truncated: spec context budget exceeded...]\n';

/** Minimal git port this module needs — injected, never read from `container`. */
export type SpecResolverGit = Pick<GitClient, 'readFile'>;

/** Optional external-URL fetcher — defaults to the real `safeFetch` adapter. */
export type SpecResolverFetch = (url: string) => Promise<string | null>;

export interface ResolveSpecContextInput {
  /** The repo the PR belongs to (for `git.readFile`). */
  repo: RepoRef;
  /** PR body/description text to scan for refs (may be null/empty). */
  body: string | null | undefined;
  /** Detail already loaded by the caller — reused for `linked_issue` + changed files. */
  prDetail: Pick<PrDetail, 'linked_issue' | 'files'>;
  /** Injected git port (`container.git`, or a mock in tests). */
  git: SpecResolverGit;
  /** Injected external-URL fetcher (`safeFetch`, or a stub in tests). Defaults to `safeFetch`. */
  fetch?: SpecResolverFetch;
}

export interface SpecContext {
  contextText: string;
  sources: IntentSource[];
}

interface CandidateRef {
  type: IntentSource['type'];
  ref: string;
  /** Resolution priority — lower sorts first (plan §1 priority order). */
  priority: number;
  /** Resolves the content, or null if unavailable. Never throws. */
  resolve: () => Promise<string | null>;
}

const MD_LINK_RE = /\[[^\]]*]\(([^)\s]+\.md)\)/gi;
const BARE_MD_RE = /(?:^|[\s(])([\w./-]+\.md)(?=[\s)]|$)/gi;
const ISSUE_REF_RE = /#(\d+)/g;
const ISSUE_URL_RE = /https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:issues|pull)\/(\d+)/gi;
const URL_RE = /https?:\/\/[^\s)]+/gi;

/** Priority order from the plan (§1, §3): lower number = kept first under budget. */
const PRIORITY = {
  pr_md: 0,
  repo_md_plan: 1,
  linked_issue: 2,
  repo_md_other: 3,
  external_url: 4,
} as const;

export async function resolveSpecContext(input: ResolveSpecContextInput): Promise<SpecContext> {
  const { repo, body, prDetail, git } = input;
  const fetchUrl = input.fetch ?? safeFetch;

  if (!body && !prDetail.linked_issue && (prDetail.files?.length ?? 0) === 0) {
    return { contextText: '', sources: [] };
  }

  const candidates: CandidateRef[] = [];

  // 1. PR-added/changed .md files (new content at head) — highest priority.
  const changedMdPaths = (prDetail.files ?? [])
    .map((f) => f.path)
    .filter((p) => p.toLowerCase().endsWith('.md'));
  for (const path of changedMdPaths) {
    candidates.push({
      type: 'pr_md',
      ref: path,
      priority: PRIORITY.pr_md,
      resolve: () => safeReadFile(git, repo, path),
    });
  }

  // 2. Repo-relative .md links referenced in the PR body (markdown links + bare paths).
  const referencedMdPaths = new Set<string>();
  if (body) {
    for (const m of body.matchAll(MD_LINK_RE)) {
      const path = m[1];
      if (path) referencedMdPaths.add(normalizeRelativePath(path));
    }
    for (const m of body.matchAll(BARE_MD_RE)) {
      const path = m[1];
      if (path) referencedMdPaths.add(normalizeRelativePath(path));
    }
  }
  for (const path of referencedMdPaths) {
    if (changedMdPaths.includes(path)) continue; // already captured as pr_md, avoid duplicate
    const isPlanDoc = path.startsWith('docs/plan/');
    candidates.push({
      type: 'repo_md',
      ref: path,
      priority: isPlanDoc ? PRIORITY.repo_md_plan : PRIORITY.repo_md_other,
      resolve: () => safeReadFile(git, repo, path),
    });
  }

  // 3. Primary linked issue (already resolved by the caller via PrDetail.linked_issue).
  if (prDetail.linked_issue) {
    const issue = prDetail.linked_issue;
    candidates.push({
      type: 'linked_issue',
      ref: `#${issue.number}`,
      priority: PRIORITY.linked_issue,
      resolve: () => Promise.resolve(formatIssue(issue)),
    });
  }

  // 4. External URLs referenced in the body — allowlist-fetched; others are reference-only.
  const seenUrls = new Set<string>();
  if (body) {
    for (const m of body.matchAll(URL_RE)) {
      const url = stripTrailingPunctuation(m[0]);
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      // Skip URLs that are just issue/PR references — already handled via linked_issue.
      if (ISSUE_URL_RE.test(url)) {
        ISSUE_URL_RE.lastIndex = 0;
        continue;
      }
      candidates.push({
        type: 'external_url',
        ref: url,
        priority: PRIORITY.external_url,
        resolve: () => fetchUrl(url),
      });
    }
  }

  // Resolve all candidates (never throws — each resolve() is best-effort).
  const resolved = await Promise.all(
    candidates.map(async (c) => ({
      candidate: c,
      content: await safeResolve(c.resolve),
    })),
  );

  // Apply priority order + the ~30KB total budget; record every source.
  resolved.sort((a, b) => a.candidate.priority - b.candidate.priority);

  const sources: IntentSource[] = [];
  const parts: string[] = [];
  let usedBytes = 0;
  let truncated = false;

  for (const { candidate, content } of resolved) {
    if (content == null || content.length === 0) {
      sources.push({ type: candidate.type, ref: candidate.ref, included: false });
      continue;
    }

    const block = formatBlock(candidate, content);
    const blockBytes = Buffer.byteLength(block, 'utf8');

    if (usedBytes + blockBytes > TOTAL_BUDGET_BYTES) {
      sources.push({ type: candidate.type, ref: candidate.ref, included: false });
      truncated = true;
      continue;
    }

    parts.push(block);
    usedBytes += blockBytes;
    sources.push({ type: candidate.type, ref: candidate.ref, included: true });
  }

  let contextText = parts.join('\n\n');
  if (truncated) contextText += TRUNCATION_MARKER;

  return { contextText, sources };
}

function formatBlock(candidate: CandidateRef, content: string): string {
  return `--- ${candidate.type}: ${candidate.ref} ---\n${content}`;
}

function formatIssue(issue: IssueMeta): string {
  return `${issue.title}\n${issue.body ?? ''}`.trim();
}

async function safeResolve(resolve: () => Promise<string | null>): Promise<string | null> {
  try {
    return await resolve();
  } catch {
    return null;
  }
}

async function safeReadFile(git: SpecResolverGit, repo: RepoRef, path: string): Promise<string | null> {
  try {
    const content = await git.readFile(repo, path);
    return content || null;
  } catch {
    return null;
  }
}

function normalizeRelativePath(path: string): string {
  return path.replace(/^\.\//, '').replace(/^\/+/, '');
}

function stripTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:!?)'"]+$/, '');
}
