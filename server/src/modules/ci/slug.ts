import { BadRequestError } from '../../platform/errors.js';

/** Derive a filename-safe slug from a display name (Decision 1). */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'agent';
}

/**
 * Abort export when two entities slugify to the same string (Decision 1).
 * Works for agents and skills — callers pass whichever set they are exporting.
 */
export function assertUniqueSlugs(items: { id: string; name: string }[]): void {
  const seen = new Map<string, { id: string; name: string }>();

  for (const item of items) {
    const slug = slugify(item.name);
    const prior = seen.get(slug);
    if (prior) {
      throw new BadRequestError(
        `Export aborted: "${prior.name}" (${prior.id}) and "${item.name}" (${item.id}) both slugify to "${slug}"`,
      );
    }
    seen.set(slug, item);
  }
}
