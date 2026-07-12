/* serialize.ts — the ONE shared client helper that reproduces the exact
   "## Project context" prompt block reviewer-core's assemblePrompt builds
   from an ordered specs[] array (reviewer-core/src/prompt.ts:30-34,
   128-131, 153). Kept as a single function so the "SERIALIZES AS" preview
   (AC-12) can never drift from the server's real rendering by being
   hand-formatted twice — if reviewer-core's format ever changes, update
   ONLY this file.

   Exact source format copied from reviewer-core/src/prompt.ts:
     wrapUntrusted(label, content) =>
       `<untrusted source="${label}">\n${safe}\n</untrusted>`
       where safe = content.replaceAll('</untrusted>', '<\\/untrusted>')
     specsBlock = specs.map((s, i) => wrapUntrusted(`spec-${i}`, s)).join('\n\n')
     userSections.push(`## Project context\n${specsBlock}`)  (only when specsBlock is non-empty) */

export interface AttachedContextDoc {
  path: string;
  content: string;
}

/** Mirrors reviewer-core/src/prompt.ts's `wrapUntrusted` verbatim. */
function wrapUntrusted(label: string, content: string): string {
  const safe = content.replaceAll("</untrusted>", "<\\/untrusted>");
  return `<untrusted source="${label}">\n${safe}\n</untrusted>`;
}

/**
 * Builds the exact `## Project context` block text for the given ordered
 * set of attached docs (path is unused in the wire format itself — only
 * content + positional index matter, matching `assemblePrompt`'s
 * `specs: string[]` input — `path` is kept on the type for caller
 * convenience/debugging only). Returns "" when there are no attached docs,
 * matching `assemblePrompt`'s omit-when-empty behavior (no `specsBlock`
 * pushed when `parts.specs` is empty/undefined).
 */
export function serializeProjectContextBlock(docs: AttachedContextDoc[]): string {
  if (docs.length === 0) return "";
  const specsBlock = docs.map((d, i) => wrapUntrusted(`spec-${i}`, d.content)).join("\n\n");
  return `## Project context\n${specsBlock}`;
}
