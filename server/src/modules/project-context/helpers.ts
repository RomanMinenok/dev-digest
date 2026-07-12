import type { ContextDoc } from '@devdigest/shared';
import type { MarkdownFile } from './walk.js';

/**
 * Deterministic token-estimate heuristic (T7): ~4 bytes per token, a common
 * rough average for English/markdown text under GPT-style BPE tokenizers.
 * This is NOT a real tokenizer call — it is a pure arithmetic estimate so the
 * same `size_bytes` input always yields the same `token_estimate` output,
 * with zero LLM calls and zero caching (AC-10/AC-13/AC-4a "live, never-cached"
 * token count requirement).
 */
const BYTES_PER_TOKEN_ESTIMATE = 4;

/** `Math.ceil` so a nonzero-size doc never rounds down to a 0-token estimate. */
export function estimateTokens(sizeBytes: number): number {
  return Math.ceil(sizeBytes / BYTES_PER_TOKEN_ESTIMATE);
}

/**
 * Number of AGENTS (agents only — AC-4, not skills) whose `context_docs`
 * list includes `path`. Pure/testable without mocking Drizzle: takes the
 * plain arrays already fetched by `repository.ts`.
 */
export function countUsedBy(
  path: string,
  agentContextDocs: readonly (readonly string[])[],
): number {
  let count = 0;
  for (const docs of agentContextDocs) {
    if (docs.includes(path)) count++;
  }
  return count;
}

/**
 * Combine a `.md` discovery walk with per-doc used-by counts into the
 * `ContextDoc` shape the Project Context list page consumes (AC-4).
 */
export function buildDiscoveryList(
  files: readonly MarkdownFile[],
  agentContextDocs: readonly (readonly string[])[],
): ContextDoc[] {
  return files.map((f) => ({
    path: f.path,
    size_bytes: f.size_bytes,
    used_by_count: countUsedBy(f.path, agentContextDocs),
  }));
}

/**
 * Union of every path referenced by any agent's OR any skill's
 * `context_docs` in the workspace — the scope the AC-4a scan-summary footer
 * needs ("docs currently attached to at least one agent or skill"), which is
 * intentionally broader than AC-4's agents-only `used_by_count`.
 */
export function unionAttachedPaths(
  agentContextDocs: readonly (readonly string[])[],
  skillContextDocs: readonly (readonly string[])[],
): Set<string> {
  const set = new Set<string>();
  for (const docs of agentContextDocs) {
    for (const p of docs) set.add(p);
  }
  for (const docs of skillContextDocs) {
    for (const p of docs) set.add(p);
  }
  return set;
}
