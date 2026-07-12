import { describe, it, expect } from 'vitest';
import { buildBlastSummaryInput } from './summary-prompt.js';
import type { BlastRadius } from '@devdigest/shared';

function blast(overrides: Partial<BlastRadius> = {}): BlastRadius {
  return {
    changed_symbols: [{ name: 'foo', file: 'src/a.ts', kind: 'function' }],
    downstream: [
      {
        symbol: 'foo',
        callers: [{ name: 'callFoo', file: 'src/c.ts', line: 5 }],
        endpoints_affected: ['GET /foo'],
        crons_affected: ['nightly-job'],
      },
    ],
    status: 'full',
    summary: '',
    ...overrides,
  };
}

describe('buildBlastSummaryInput', () => {
  it('includes counts and top symbols/endpoints/crons', () => {
    const input = buildBlastSummaryInput(blast());
    expect(input).toContain('changed_symbols: 1');
    expect(input).toContain('total_callers: 1');
    expect(input).toContain('affected_endpoints: 1');
    expect(input).toContain('affected_crons: 1');
    expect(input).toContain('foo (src/a.ts)');
    expect(input).toContain('GET /foo');
    expect(input).toContain('nightly-job');
  });

  it('never dumps the full caller list', () => {
    const input = buildBlastSummaryInput(blast());
    expect(input).not.toContain('callFoo');
    expect(input).not.toContain('src/c.ts');
  });
});
