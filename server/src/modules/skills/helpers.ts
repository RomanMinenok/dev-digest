import AdmZip from 'adm-zip';
import type { Skill, SkillType, SkillVersion } from '@devdigest/shared';
import { BadRequestError } from '../../platform/errors.js';
import type { SkillRow, SkillVersionRow } from './repository.js';

/**
 * Pure helpers for the skills module — DB row ⇄ DTO mapping, the body-version-
 * bump rule, and markdown/archive extraction for import. No I/O beyond the
 * passed-in buffer (no filesystem, no network).
 */

/** Map a persisted skill row to the public `Skill` DTO (snake_case). */
export function toSkillDto(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
  };
}

/** Map a persisted `skill_versions` row to the public `SkillVersion` DTO. */
export function toSkillVersionDto(row: SkillVersionRow): SkillVersion {
  return {
    skill_id: row.skillId,
    version: row.version,
    summary: row.summary ?? null,
    body: row.body,
    created_at: row.createdAt.toISOString(),
  };
}

/**
 * True when a patch changes the skill body relative to the existing row — a body
 * change bumps the version and snapshots a new `skill_versions` row. Toggling
 * `enabled` or editing name/description/type does NOT bump (mirrors agents,
 * where only config bumps).
 */
export function isBodyChange(
  existing: Pick<SkillRow, 'body'>,
  patch: { body?: string },
): boolean {
  return patch.body !== undefined && patch.body !== existing.body;
}

// ---- Import extraction --------------------------------------------------

/** The skill core extracted from an uploaded markdown file or archive. */
export interface ExtractedSkill {
  name: string | null;
  description: string | null;
  type: SkillType;
  body: string;
  source: 'extracted';
}

/**
 * Minimal `---`-fence frontmatter parser. If the file starts with a `---\n…\n---`
 * fence, parse simple single-line `key: value` pairs (nested YAML is ignored) and
 * strip the fence from the body. No new YAML dependency.
 */
export function parseFrontmatter(md: string): {
  attrs: Record<string, string>;
  body: string;
} {
  const attrs: Record<string, string> = {};
  // Normalize CRLF so the fence regex matches on Windows-authored files.
  const text = md.replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { attrs, body: text };

  for (const line of match[1]!.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (!key) continue;
    // Strip matching surrounding quotes from simple scalar values.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    attrs[key] = value;
  }
  return { attrs, body: text.slice(match[0].length) };
}

/** Valid skill types (kept local to avoid importing the zod enum for a cheap check). */
const SKILL_TYPES: readonly SkillType[] = ['rubric', 'convention', 'security', 'custom'];

function coerceType(raw: string | undefined): SkillType {
  return raw !== undefined && (SKILL_TYPES as readonly string[]).includes(raw)
    ? (raw as SkillType)
    : 'custom';
}

/**
 * Extract a skill core from a markdown string. Frontmatter `name`/`description`/
 * `type` win; otherwise: name = first `# H1`, description = first paragraph,
 * type = `custom`, body = the full markdown with the frontmatter fence stripped.
 */
export function extractFromMarkdown(md: string): ExtractedSkill {
  const { attrs, body } = parseFrontmatter(md);

  const name = attrs.name ?? firstHeading(body) ?? null;
  const description = attrs.description ?? firstParagraph(body) ?? null;
  const type = coerceType(attrs.type);

  return { name, description, type, body, source: 'extracted' };
}

/**
 * Extract a skill core from a zip archive via `adm-zip`. Picks `SKILL.md` if
 * present, else the first `*.md` entry; every other entry (scripts, binaries,
 * nested dirs) is ignored. Throws `BadRequestError` when no markdown is found.
 */
export function extractFromArchive(buf: Buffer): ExtractedSkill {
  const zip = new AdmZip(buf);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);

  const markdown =
    entries.find((e) => baseName(e.entryName).toLowerCase() === 'skill.md') ??
    entries.find((e) => e.entryName.toLowerCase().endsWith('.md'));

  if (!markdown) {
    throw new BadRequestError('No markdown skill found in archive');
  }
  return extractFromMarkdown(markdown.getData().toString('utf8'));
}

function baseName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

/** First markdown `# H1` heading text, or undefined. */
function firstHeading(md: string): string | undefined {
  for (const line of md.split('\n')) {
    const m = /^#\s+(.+?)\s*$/.exec(line);
    if (m) return m[1];
  }
  return undefined;
}

/** First non-empty, non-heading paragraph line, or undefined. */
function firstParagraph(md: string): string | undefined {
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    return line;
  }
  return undefined;
}
