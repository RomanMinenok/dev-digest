import { describe, it, expect } from 'vitest';
import type { UnifiedDiff } from '@devdigest/shared';
import { buildIntentInput, estimateFullDiffTokens } from './input-builder.js';

const DIFF: UnifiedDiff = {
  raw: 'diff --git a/src/config.ts b/src/config.ts\n--- a/src/config.ts\n+++ b/src/config.ts\n@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
  files: [
    {
      path: 'src/config.ts',
      additions: 1,
      deletions: 0,
      hunks: [
        { file: 'src/config.ts', oldStart: 10, oldLines: 3, newStart: 10, newLines: 4, newLineNumbers: [11] },
      ],
    },
  ],
};

const EMPTY_DIFF: UnifiedDiff = { raw: '', files: [] };

describe('buildIntentInput', () => {
  it('includes title, body, spec context, and reconstructed hunk headers when all are present', () => {
    const input = buildIntentInput({
      title: 'Add rate limiting',
      body: 'Closes #471. Adds a token bucket limiter.',
      specContext: '--- linked_issue: #471 ---\nRate limit the public API',
      diff: DIFF,
    });

    expect(input).toContain('Add rate limiting');
    expect(input).toContain('Closes #471. Adds a token bucket limiter.');
    expect(input).toContain('Rate limit the public API');
    expect(input).toContain('src/config.ts');
    expect(input).toContain('@@ -10,3 +10,4 @@');
  });

  it('never includes diff body lines, only reconstructed headers', () => {
    const input = buildIntentInput({ title: 'x', diff: DIFF });
    expect(input).not.toContain('stripeKey');
    expect(input).not.toContain('redisUrl');
    expect(input).not.toContain('port: 3000');
  });

  it('with no body/spec still returns a non-empty input containing title + headers', () => {
    const input = buildIntentInput({ title: 'Fix login bug', diff: DIFF });
    expect(input.length).toBeGreaterThan(0);
    expect(input).toContain('Fix login bug');
    expect(input).toContain('@@ -10,3 +10,4 @@');
    expect(input).not.toContain('# PR description');
    expect(input).not.toContain('# Additional context');
  });

  it('with no body/spec/diff files still returns a non-empty input (title only)', () => {
    const input = buildIntentInput({ title: 'Empty PR', diff: EMPTY_DIFF });
    expect(input.length).toBeGreaterThan(0);
    expect(input).toContain('Empty PR');
    expect(input).toContain('(no changed files)');
  });

  it('omits body/spec sections when blank/whitespace-only', () => {
    const input = buildIntentInput({ title: 'x', body: '   ', specContext: '', diff: DIFF });
    expect(input).not.toContain('# PR description');
    expect(input).not.toContain('# Additional context');
  });
});

describe('estimateFullDiffTokens', () => {
  it('returns a baseline token count strictly greater than the headers-only input token count', () => {
    const tokenizer = { count: (text: string) => Math.ceil(text.length / 4) };

    // A raw diff body much larger than its reconstructed headers — the
    // realistic case the token-savings log measures against.
    const bigDiff: UnifiedDiff = {
      raw: DIFF.raw + '\n' + 'context line unchanged\n'.repeat(200),
      files: DIFF.files,
    };

    const fullDiffTokens = estimateFullDiffTokens(bigDiff, tokenizer);
    const headersInput = buildIntentInput({ title: 'Add rate limiting', diff: bigDiff });
    const headerTokens = tokenizer.count(headersInput);

    expect(fullDiffTokens).toBeGreaterThan(0);
    // The raw diff body (with all changed lines) tokenizes far larger than
    // just title + reconstructed hunk headers — this is the token-savings claim.
    expect(headerTokens).toBeLessThan(fullDiffTokens);
  });
});
