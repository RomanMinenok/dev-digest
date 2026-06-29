import { readdir } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import type { ConventionCandidate } from '@devdigest/shared';
import type { ConventionRow } from '../../db/rows.js';

export function toConventionDto(row: ConventionRow): ConventionCandidate {
  return {
    id: row.id,
    rule: row.rule,
    evidence_path: row.evidencePath ?? '',
    evidence_snippet: row.evidenceSnippet ?? '',
    confidence: row.confidence ?? 0,
    accepted: row.accepted,
  };
}

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'build', 'out', '.next', 'coverage']);
const SKIP_PATTERNS = ['.test.', '.spec.', '__tests__', '__mocks__'];

function isSkippedPath(relPath: string): boolean {
  return SKIP_PATTERNS.some((p) => relPath.includes(p));
}

export async function fallbackWalk(clonePath: string, max: number): Promise<string[]> {
  const results: string[] = [];
  const queue: string[] = [clonePath];

  while (queue.length > 0 && results.length < max) {
    const dir = queue.shift()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (results.length >= max) break;
      const fullPath = join(dir, entry.name);
      const relPath = relative(clonePath, fullPath);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          queue.push(fullPath);
        }
      } else if (entry.isFile()) {
        if (SOURCE_EXTS.has(extname(entry.name)) && !isSkippedPath(relPath)) {
          results.push(relPath);
        }
      }
    }
  }

  return results;
}
