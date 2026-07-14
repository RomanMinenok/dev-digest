import type { ExpectedFinding } from '@devdigest/shared';

/**
 * A blank expected-finding object the "Finding skeleton" button inserts into
 * the Expected output editor (AC-12). Users fill in the real values from
 * their case's diff.
 */
export const FINDING_SKELETON: ExpectedFinding = {
  severity: 'WARNING',
  category: 'bug',
  title: '',
  file: '',
  start_line: 1,
};
