import { describe, it, expect } from 'vitest';
import { assembleBlast, blastStatus } from './helpers.js';
import type { BlastResult, IndexState } from '../repo-intel/types.js';

function indexState(overrides: Partial<IndexState> = {}): IndexState {
  return {
    repoId: 'r1',
    status: 'full',
    filesIndexed: 10,
    filesSkipped: 0,
    durationMs: 100,
    lastIndexedSha: 'sha1',
    indexerVersion: 1,
    updatedAt: new Date(0),
    ...overrides,
  };
}

function blastResult(overrides: Partial<BlastResult> = {}): BlastResult {
  return {
    changedSymbols: [{ file: 'src/a.ts', name: 'foo', kind: 'function' }],
    callers: [],
    impactedEndpoints: [],
    ...overrides,
  };
}

describe('assembleBlast', () => {
  it('groups callers by viaSymbol into one DownstreamImpact per changed symbol', () => {
    const result = blastResult({
      changedSymbols: [
        { file: 'src/a.ts', name: 'foo', kind: 'function' },
        { file: 'src/b.ts', name: 'bar', kind: 'function' },
      ],
      callers: [
        { file: 'src/c.ts', symbol: 'callFoo', viaSymbol: 'foo', line: 5, rank: 1 },
        { file: 'src/d.ts', symbol: 'callBar', viaSymbol: 'bar', line: 9, rank: 2 },
      ],
    });

    const blast = assembleBlast(result, indexState());

    expect(blast.changed_symbols).toEqual([
      { name: 'foo', file: 'src/a.ts', kind: 'function' },
      { name: 'bar', file: 'src/b.ts', kind: 'function' },
    ]);
    expect(blast.downstream).toEqual([
      {
        symbol: 'foo',
        callers: [{ name: 'callFoo', file: 'src/c.ts', line: 5 }],
        endpoints_affected: [],
        crons_affected: [],
      },
      {
        symbol: 'bar',
        callers: [{ name: 'callBar', file: 'src/d.ts', line: 9 }],
        endpoints_affected: [],
        crons_affected: [],
      },
    ]);
  });

  it('caps callers at 20 per symbol, sorted by rank desc then line', () => {
    const callers = Array.from({ length: 25 }, (_, i) => ({
      file: `src/caller${i}.ts`,
      symbol: `caller${i}`,
      viaSymbol: 'foo',
      line: 25 - i,
      rank: i,
    }));
    const result = blastResult({ callers });

    const blast = assembleBlast(result, indexState());

    expect(blast.downstream[0]!.callers).toHaveLength(20);
    // Highest rank (24) sorts first.
    expect(blast.downstream[0]!.callers[0]).toEqual({ name: 'caller24', file: 'src/caller24.ts', line: 1 });
  });

  it('attributes endpoints/crons from factsByFile on the persistent path', () => {
    const result = blastResult({
      callers: [{ file: 'src/c.ts', symbol: 'callFoo', viaSymbol: 'foo', line: 5, rank: 1 }],
      factsByFile: { 'src/c.ts': { endpoints: ['GET /foo'], crons: ['nightly-job'] } },
    });

    const blast = assembleBlast(result, indexState());

    expect(blast.downstream[0]!.endpoints_affected).toEqual(['GET /foo']);
    expect(blast.downstream[0]!.crons_affected).toEqual(['nightly-job']);
  });

  it('falls back to flat impactedEndpoints with empty crons when factsByFile is absent (degraded path)', () => {
    const result = blastResult({
      callers: [{ file: 'src/c.ts', symbol: 'callFoo', viaSymbol: 'foo', line: 5, rank: 0 }],
      impactedEndpoints: ['GET /foo', 'POST /foo'],
      degraded: true,
      reason: 'no_data',
    });

    const blast = assembleBlast(result, indexState({ degraded: true, degradedReason: 'no_data' }));

    expect(blast.downstream[0]!.endpoints_affected).toEqual(['GET /foo', 'POST /foo']);
    expect(blast.downstream[0]!.crons_affected).toEqual([]);
    expect(blast.status).toBe('degraded');
  });

  it('always returns summary: ""', () => {
    const blast = assembleBlast(blastResult(), indexState());
    expect(blast.summary).toBe('');
  });
});

describe('blastStatus', () => {
  it('maps full index + non-degraded result to full', () => {
    expect(blastStatus(indexState({ status: 'full' }), blastResult())).toBe('full');
  });

  it('maps partial index to partial', () => {
    expect(blastStatus(indexState({ status: 'partial' }), blastResult())).toBe('partial');
  });

  it('maps degraded/failed index to degraded', () => {
    expect(blastStatus(indexState({ status: 'degraded' }), blastResult())).toBe('degraded');
    expect(blastStatus(indexState({ status: 'failed' }), blastResult())).toBe('degraded');
  });

  it('forces degraded when the blast result itself degraded, even with a full index', () => {
    expect(blastStatus(indexState({ status: 'full' }), blastResult({ degraded: true }))).toBe('degraded');
  });
});
