import { describe, it, expect } from 'vitest';
import { classifyFile } from './classifier.js';

describe('classifyFile', () => {
  describe('boilerplate', () => {
    it.each([
      'pnpm-lock.yaml',
      'yarn.lock',
      'dist/index.js',
      '0001_migration.sql',
      '__snapshots__/x.snap',
    ])('%s', (path) => {
      expect(classifyFile(path)).toBe('boilerplate');
    });
  });

  describe('wiring', () => {
    it.each([
      'src/index.ts',
      'src/db/schema/repos.ts',
      'vite.config.ts',
      'tsconfig.json',
      'src/modules/pulls/routes.ts',
    ])('%s', (path) => {
      expect(classifyFile(path)).toBe('wiring');
    });
  });

  describe('core', () => {
    it.each([
      'src/modules/reviews/service.ts',
      'src/modules/pulls/classifier.ts',
      'src/components/Button.tsx',
      'src/lib/utils.ts',
      'src/modules/reviews/helpers.ts',
    ])('%s', (path) => {
      expect(classifyFile(path)).toBe('core');
    });
  });
});
