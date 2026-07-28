import { describe, expect, it } from 'vitest';
import type { Finding } from '@devdigest/shared';
import { buildCells } from './cells.js';
import type { AttributedFinding, LocationGroup } from './types.js';

const finding = (id: string, agentId: string, severity: Finding['severity'] = 'WARNING'): AttributedFinding => ({
  agentId,
  runId: `run-${agentId}`,
  finding: {
    id,
    severity,
    category: 'bug',
    title: `${agentId} finding`,
    file: 'a.ts',
    start_line: 1,
    end_line: 1,
    rationale: 'r',
    confidence: 0.9,
  },
});

const group = (findings: AttributedFinding[]): LocationGroup => ({
  file: 'a.ts',
  minStartLine: 1,
  minEndLine: 1,
  findings,
});

describe('buildCells', () => {
  it('marks a still-running member with no findings as pending (not did_not_flag / failed)', () => {
    const cells = buildCells(group([finding('f1', 'a1')]), [
      { agentId: 'a1', status: 'done' },
      { agentId: 'a2', status: 'running' },
    ]);
    expect(cells).toEqual([
      { state: 'severity', agentId: 'a1', severity: 'WARNING' },
      { state: 'pending', agentId: 'a2' },
    ]);
  });

  it('still uses did_not_flag only for done members with no findings', () => {
    const cells = buildCells(group([finding('f1', 'a1')]), [
      { agentId: 'a1', status: 'done' },
      { agentId: 'a2', status: 'done' },
    ]);
    expect(cells[1]).toEqual({ state: 'did_not_flag', agentId: 'a2' });
  });

  it('still uses failed for cancelled / failed members with no findings', () => {
    const cells = buildCells(group([finding('f1', 'a1')]), [
      { agentId: 'a1', status: 'done' },
      { agentId: 'a2', status: 'failed' },
      { agentId: 'a3', status: 'cancelled' },
    ]);
    expect(cells[1]).toEqual({ state: 'failed', agentId: 'a2' });
    expect(cells[2]).toEqual({ state: 'failed', agentId: 'a3' });
  });
});
