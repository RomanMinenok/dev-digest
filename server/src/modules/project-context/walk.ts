/**
 * project-context — `.md` discovery walk.
 *
 * Recursively walks a repo clone and returns EVERY `.md` file in it, at any
 * depth, regardless of folder name (no `specs/`/`docs/`-only restriction, no
 * configurable root — always the whole clone). Modeled on
 * `modules/repo-intel/pipeline/walk.ts`'s walking pattern (skip symlinks,
 * reuse `EXCLUDED_DIRS`), but deliberately simpler:
 *   - No extension allowlist beyond `.md`.
 *   - No `MAX_FILE_SIZE` / `MAX_INDEXED_FILES` caps (SPEC-01 explicitly does
 *     NOT introduce one for project-context, unlike the code indexer).
 *
 * Pure-ish: takes a root path + does fs ops; returns plain data. Infrastructure
 * layer — no DB, no Fastify — so `service.ts` (T7) can inject this behind a
 * port rather than importing filesystem logic directly into business logic.
 */
import { readdir, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { EXCLUDED_DIRS, MD_EXT } from './constants.js';

const EXCLUDED_SET: ReadonlySet<string> = new Set(EXCLUDED_DIRS);

export interface MarkdownFile {
  /** Path relative to `root`, separator-normalized to forward slashes. */
  path: string;
  size_bytes: number;
}

/**
 * Recursively walk `root`, returning every `.md` file found (repo-relative,
 * forward-slash-normalized paths), excluding `EXCLUDED_DIRS` and never
 * following symlinks.
 */
export async function walkMarkdownFiles(root: string): Promise<MarkdownFile[]> {
  const out: MarkdownFile[] = [];
  await walkDir(root, root, out);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

async function walkDir(root: string, dir: string, out: MarkdownFile[]): Promise<void> {
  let entries: Dirent[];
  try {
    entries = (await readdir(dir, { withFileTypes: true })) as Dirent[];
  } catch {
    // Unreadable directory (permissions, dangling symlink) — skip cleanly so
    // the walk keeps making progress on the parts of the clone it CAN read.
    return;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue; // never follow symlinks (loops, perf)
    const name = entry.name;

    if (entry.isDirectory()) {
      if (EXCLUDED_SET.has(name)) continue;
      await walkDir(root, join(dir, name), out);
      continue;
    }

    if (!entry.isFile()) continue;
    if (extname(name).toLowerCase() !== MD_EXT) continue;

    const full = join(dir, name);
    let size: number;
    try {
      size = (await stat(full)).size;
    } catch {
      continue;
    }

    // Posix-style relative path so results are platform-agnostic.
    const rel = relative(root, full).split(sep).join('/');
    out.push({ path: rel, size_bytes: size });
  }
}
