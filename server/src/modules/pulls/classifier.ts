import type { SmartDiffRole } from '@devdigest/shared';
import { BOILERPLATE_PATTERNS, WIRING_PATTERNS } from './classifier-patterns.js';

export function classifyFile(path: string): SmartDiffRole {
  if (BOILERPLATE_PATTERNS.some((pattern) => pattern.test(path))) return 'boilerplate';
  if (WIRING_PATTERNS.some((pattern) => pattern.test(path))) return 'wiring';
  return 'core';
}
