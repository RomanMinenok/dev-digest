import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MockLLMProvider } from '../../adapters/mocks.js';
import { extractConventions } from './extractor.js';

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'conventions-test-'));
}

describe('extractConventions', () => {
  const tmpDirs: string[] = [];

  afterEach(async () => {
    for (const d of tmpDirs) {
      await rm(d, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
  });

  it('keeps verified candidates and drops hallucinated ones', async () => {
    const dir = await makeTempDir();
    tmpDirs.push(dir);

    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(
      join(dir, 'src/api.ts'),
      'export async function fetchUser() {\n  return await db.users.find(id);\n}',
    );

    const llm = new MockLLMProvider('openai', {
      structured: {
        candidates: [
          {
            rule: 'Always use async/await instead of promise chains',
            evidence_path: 'src/api.ts',
            evidence_snippet: 'export async function fetchUser() {\n  return await db.users.find(id);\n}',
            confidence: 0.9,
          },
          {
            rule: 'Use Redis for caching (hallucinated)',
            evidence_path: 'src/cache.ts',
            evidence_snippet: 'export const redis = new Redis(config.redisUrl);',
            confidence: 0.85,
          },
        ],
      },
    });

    const drafts = await extractConventions({
      repoName: 'test-repo',
      clonePath: dir,
      samplePaths: ['src/api.ts'],
      llm,
      model: 'gpt-4.1',
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.rule).toBe('Always use async/await instead of promise chains');
  });

  it('drops candidates with confidence <= 0.6', async () => {
    const dir = await makeTempDir();
    tmpDirs.push(dir);

    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src/utils.ts'), 'export function helper() {\n  return 42;\n}');

    const llm = new MockLLMProvider('openai', {
      structured: {
        candidates: [
          {
            rule: 'Always export pure functions',
            evidence_path: 'src/utils.ts',
            evidence_snippet: 'export function helper() {\n  return 42;\n}',
            confidence: 0.5,
          },
        ],
      },
    });

    const drafts = await extractConventions({
      repoName: 'test-repo',
      clonePath: dir,
      samplePaths: ['src/utils.ts'],
      llm,
      model: 'gpt-4.1',
    });

    expect(drafts).toHaveLength(0);
  });

  it('includes config file contents in the LLM prompt', async () => {
    const dir = await makeTempDir();
    tmpDirs.push(dir);

    await writeFile(join(dir, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}');
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src/index.ts'), 'export const x = 1;');

    const llm = new MockLLMProvider('openai', {
      structured: { candidates: [] },
    });

    await extractConventions({
      repoName: 'test-repo',
      clonePath: dir,
      samplePaths: ['src/index.ts'],
      llm,
      model: 'gpt-4.1',
    });

    const call = llm.calls.find((c) => c.method === 'completeStructured');
    expect(call).toBeDefined();
    const req = call!.req as { messages: { role: string; content: string }[] };
    const userMsg = req.messages.find((m) => m.role === 'user')!;
    expect(userMsg.content).toContain('tsconfig.json');
    expect(userMsg.content).toContain('"strict":true');
  });
});
