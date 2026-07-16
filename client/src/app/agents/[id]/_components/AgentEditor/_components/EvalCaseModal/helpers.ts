import { z } from 'zod';
import { ExpectedFinding } from '@devdigest/shared';

// ---------------------------------------------------------------------------
// parseExpectedOutput (AC-7)
// ---------------------------------------------------------------------------

const ExpectedOutputSchema = z.array(ExpectedFinding);

/**
 * Why the expected-output text was rejected.
 *
 * These are genuinely different failures and must not be reported with the same
 * words. `syntax` is malformed JSON (a missing comma, a trailing brace).
 * `schema` is well-formed JSON that is not a valid expected-finding array — most
 * commonly the `Finding skeleton` template, which is deliberately inserted with
 * empty `title`/`file` for the user to fill in. Labelling that "invalid JSON"
 * sends the user hunting for a syntax error that does not exist.
 */
export type ExpectedOutputErrorKind = 'syntax' | 'schema';

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; kind: ExpectedOutputErrorKind; error: string };

/**
 * Parse and validate the expected-output JSON text entered in the modal editor
 * (AC-7). Returns `{ ok: true, value }`, or a failure tagged with its `kind` and
 * a message naming the offending field (e.g. `0.title: …`).
 */
export function parseExpectedOutput(
  text: string,
): ParseResult<z.infer<typeof ExpectedOutputSchema>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      kind: 'syntax',
      error: err instanceof Error ? err.message : 'Invalid JSON',
    };
  }
  const result = ExpectedOutputSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const message = first
      ? `${first.path.length > 0 ? first.path.join('.') + ': ' : ''}${first.message}`
      : result.error.message;
    return { ok: false, kind: 'schema', error: message };
  }
  return { ok: true, value: result.data };
}

// ---------------------------------------------------------------------------
// expectationsOffDiff
// ---------------------------------------------------------------------------

/**
 * Return the subset of expected findings whose `file` does not appear in
 * `diffText`. Used at save time to warn the user that those expectations can
 * never be satisfied by the case's diff (spec edge case).
 *
 * File presence is determined by scanning for `diff --git a/<path>` header
 * lines — the same format `sliceDiffToFile` emits.
 */
export function expectationsOffDiff(
  expected: Array<{ file: string }>,
  diffText: string,
): Array<{ file: string }> {
  const filesInDiff = new Set<string>();
  for (const line of diffText.split('\n')) {
    // Match: diff --git a/<path> b/<path>
    const match = /^diff --git a\/(.+) b\/.+$/.exec(line);
    if (match && match[1]) {
      filesInDiff.add(match[1]);
    }
  }
  return expected.filter((e) => !filesInDiff.has(e.file));
}
