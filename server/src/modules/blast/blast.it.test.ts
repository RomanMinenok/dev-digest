import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { seed } from '../../db/seed.js';
import * as t from '../../db/schema.js';
import { MockLLMProvider } from '../../adapters/mocks.js';
import type { ContainerOverrides } from '../../platform/container.js';
import type { RepoIntel, BlastResult, IndexState } from '../repo-intel/types.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[blast] Docker not available — skipping integration tests.');
}

const CANNED_RESULT: BlastResult = {
  changedSymbols: [{ file: 'src/a.ts', name: 'foo', kind: 'function' }],
  callers: [{ file: 'src/b.ts', symbol: 'callFoo', viaSymbol: 'foo', line: 5, rank: 1 }],
  impactedEndpoints: ['GET /foo'],
  factsByFile: { 'src/b.ts': { endpoints: ['GET /foo'], crons: [] } },
};

const CANNED_INDEX: IndexState = {
  repoId: 'unused',
  status: 'full',
  filesIndexed: 10,
  filesSkipped: 0,
  durationMs: 100,
  lastIndexedSha: 'sha1',
  indexerVersion: 1,
  updatedAt: new Date(0),
};

function mockRepoIntel(overrides: { result?: BlastResult; index?: IndexState } = {}): RepoIntel {
  const impl: Partial<RepoIntel> = {
    getBlastRadius: async () => overrides.result ?? CANNED_RESULT,
    getIndexState: async () => overrides.index ?? CANNED_INDEX,
  };
  return impl as unknown as RepoIntel;
}

d('Blast module (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let repoId: string;
  let repoSeq = 0;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces).where(eq(t.workspaces.name, 'default'));
    workspaceId = ws!.id;

    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'blast-it', fullName: 'acme/blast-it' })
      .returning();
    repoId = repo!.id;
  });

  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp(overrides: Partial<ContainerOverrides> = {}) {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        repoIntel: mockRepoIntel(),
        ...overrides,
      },
    });
  }

  async function setupPr(headSha = 'sha1') {
    const number = ++repoSeq;
    const [pull] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number,
        title: 'PR',
        author: 'a',
        branch: 'b',
        base: 'main',
        headSha,
        status: 'needs_review',
      })
      .returning();
    await pg.handle.db.insert(t.prFiles).values({ prId: pull!.id, path: 'src/a.ts', additions: 1, deletions: 0 });
    return pull!;
  }

  it('GET /pulls/:id/blast returns 200 instantly with summary:"" and grouped downstream', async () => {
    const app = await makeApp();
    const pr = await setupPr();

    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/blast` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.summary).toBe('');
    expect(body.status).toBe('full');
    expect(body.changed_symbols).toEqual([{ name: 'foo', file: 'src/a.ts', kind: 'function' }]);
    expect(body.downstream).toEqual([
      {
        symbol: 'foo',
        callers: [{ name: 'callFoo', file: 'src/b.ts', line: 5 }],
        endpoints_affected: ['GET /foo'],
        crons_affected: [],
      },
    ]);

    await app.close();
  });

  it('degraded index state yields status: "degraded"', async () => {
    const app = await makeApp({
      repoIntel: mockRepoIntel({ index: { ...CANNED_INDEX, status: 'degraded', degraded: true } }),
    });
    const pr = await setupPr();

    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/blast` });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('degraded');

    await app.close();
  });

  it('POST /pulls/:id/blast/explain returns the mocked summary via one LLM call', async () => {
    // openrouter only implements completeStructured (server/INSIGHTS.md) — the
    // real bug this test now guards: explain() must NOT call `.complete()`.
    const llm = new MockLLMProvider('openai', { structured: { summary: 'This change reaches one HTTP endpoint.' } });
    const app = await makeApp({ llm: { openrouter: llm } });
    const pr = await setupPr();

    const res = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/blast/explain` });
    expect(res.statusCode).toBe(200);
    expect(res.json().summary).toBe('This change reaches one HTTP endpoint.');
    expect(llm.calls.filter((c) => c.method === 'completeStructured')).toHaveLength(1);

    await app.close();
  });

  it('unknown PR id returns 404', async () => {
    const app = await makeApp();

    const res = await app.inject({ method: 'GET', url: `/pulls/${crypto.randomUUID()}/blast` });
    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
