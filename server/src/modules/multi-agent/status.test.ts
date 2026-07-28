import { describe, it, expect } from 'vitest';
import { deriveStatus } from './status.js';

const m = (status: string | null) => ({ status });

describe('deriveStatus', () => {
  // AC-15 — one fixture per branch.
  it('is running while any member is still running', () => {
    expect(deriveStatus([m('done'), m('running'), m('failed')])).toBe('running');
  });

  it('is done when every member is done', () => {
    expect(deriveStatus([m('done'), m('done')])).toBe('done');
  });

  it('is partial when every member is terminal and some but not all succeeded', () => {
    expect(deriveStatus([m('done'), m('failed')])).toBe('partial');
  });

  it('is failed when every member is terminal and none succeeded', () => {
    expect(deriveStatus([m('failed'), m('failed')])).toBe('failed');
  });

  // AC-34 — a cancelled member is a failed member, not a fourth vocabulary.
  it('counts a cancelled member as failed', () => {
    expect(deriveStatus([m('cancelled')])).toBe('failed');
    expect(deriveStatus([m('done'), m('cancelled')])).toBe('partial');
  });

  // Fail-closed: anything that is not literally 'running'/'done' is failed, so
  // a status added later can never silently read as success.
  it.each([null, 'queued', 'reaped', 'some_future_status'])(
    'treats %s as failed rather than done or running',
    (status) => {
      expect(deriveStatus([m(status)])).toBe('failed');
    },
  );

  // A multi-run with no members cannot be 'done'.
  it('is failed for zero members', () => {
    expect(deriveStatus([])).toBe('failed');
  });
});
