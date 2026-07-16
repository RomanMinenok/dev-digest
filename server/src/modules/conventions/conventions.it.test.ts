import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { seed } from '../../db/seed.js';
import * as t from '../../db/schema.js';
import { MockGitClient, MockGitHubClient, MockLLMProvider } from '../../adapters/mocks.js';
import type { RepoIntel } from '../repo-intel/types.js';
import type { ContainerOverrides } from '../../platform/container.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[conventions] Docker not available — skipping integration tests.');
}

// Minimal RepoIntel stub: getConventionSamples returns [] so fallbackWalk runs.
const stubRepoIntel = {
  getConventionSamples: async () => [],
} as unknown as RepoIntel;

// Fixture source code used in scan tests. First line must be verifiable.
const FIXTURE_CODE =
  'export async function fetchUser() {\n  return db.users.find();\n}';

d('Conventions module (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  /** Repo without clonePath — used for 400 test. */
  let noCloneRepoId: string;
  /** Repo pointing at a real temp dir — used for scan tests. */
  let cloneRepoId: string;
  let cloneDir: string;
  const tmpDirs: string[] = [];

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);

    const [ws] = await pg.handle.db
      .select()
      .from(t.workspaces)
      .where(eq(t.workspaces.name, 'default'));
    workspaceId = ws!.id;

    // Repo A — no clonePath (for 400 test).
    const [repoA] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'test', name: 'no-clone', fullName: 'test/no-clone' })
      .returning();
    noCloneRepoId = repoA!.id;

    // Repo B — has a real clonePath with one source file.
    cloneDir = await mkdtemp(join(tmpdir(), 'conv-it-'));
    tmpDirs.push(cloneDir);
    await mkdir(join(cloneDir, 'src'), { recursive: true });
    await writeFile(join(cloneDir, 'src', 'api.ts'), FIXTURE_CODE);

    const [repoB] = await pg.handle.db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'test',
        name: 'with-clone',
        fullName: 'test/with-clone',
        clonePath: cloneDir,
      })
      .returning();
    cloneRepoId = repoB!.id;
  });

  afterAll(async () => {
    for (const dir of tmpDirs) await rm(dir, { recursive: true, force: true });
    await pg?.stop();
  });

  function makeApp(overrides: Partial<ContainerOverrides> = {}) {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        repoIntel: stubRepoIntel,
        ...overrides,
      },
    });
  }

  function makeLlm(candidates: object[]) {
    return new MockLLMProvider('openai', { structured: { candidates } });
  }

  // ---- GET /repos/:repoId/conventions ----------------------------------------

  describe('GET /repos/:repoId/conventions', () => {
    it('returns [] for a repo with no conventions yet', async () => {
      const app = await makeApp();
      const res = await app.inject({ method: 'GET', url: `/repos/${noCloneRepoId}/conventions` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
      await app.close();
    });

    it('returns 404 for an unknown repoId', async () => {
      const app = await makeApp();
      const res = await app.inject({
        method: 'GET',
        url: '/repos/00000000-0000-0000-0000-000000000000/conventions',
      });
      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 404 for a repo that belongs to a different workspace (cross-tenant guard)', async () => {
      const app = await makeApp();
      const [other] = await pg.handle.db
        .insert(t.workspaces)
        .values({ name: 'other-conv-ws' })
        .returning();
      const [foreign] = await pg.handle.db
        .insert(t.repos)
        .values({
          workspaceId: other!.id,
          owner: 'x',
          name: 'foreign',
          fullName: 'x/foreign',        })
        .returning();
      const res = await app.inject({ method: 'GET', url: `/repos/${foreign!.id}/conventions` });
      expect(res.statusCode).toBe(404);
      await app.close();
    });
  });

  // ---- POST /repos/:repoId/conventions/rescan --------------------------------

  describe('POST /repos/:repoId/conventions/rescan', () => {
    it('returns 400 when the repo has no clonePath', async () => {
      const app = await makeApp();
      const res = await app.inject({
        method: 'POST',
        url: `/repos/${noCloneRepoId}/conventions/rescan`,
      });
      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it('returns 404 for an unknown repoId', async () => {
      const app = await makeApp();
      const res = await app.inject({
        method: 'POST',
        url: '/repos/00000000-0000-0000-0000-000000000000/conventions/rescan',
      });
      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('runs the extractor with mock LLM and returns ConventionScanResult', async () => {
      const llm = makeLlm([
        {
          rule: 'Always use async/await instead of promise chains',
          evidence_path: 'src/api.ts',
          evidence_snippet: FIXTURE_CODE,
          confidence: 0.9,
        },
      ]);

      const app = await makeApp({ llm: { openrouter: llm } });
      const res = await app.inject({ method: 'POST', url: `/repos/${cloneRepoId}/conventions/rescan` });
      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.repo_id).toBe(cloneRepoId);
      expect(body.repo_name).toBe('test/with-clone');
      expect(body.sample_count).toBeGreaterThan(0);
      expect(body.scanned_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(body.candidates).toHaveLength(1);
      expect(body.candidates[0].rule).toBe('Always use async/await instead of promise chains');
      expect(body.candidates[0].accepted).toBe(false);
      expect(body.candidates[0].evidence_path).toBe('src/api.ts');

      await app.close();
    });

    it('excludes hallucinated candidates whose snippet first line is not in the file', async () => {
      const llm = makeLlm([
        {
          rule: 'Real rule — first line exists in file',
          evidence_path: 'src/api.ts',
          evidence_snippet: FIXTURE_CODE,
          confidence: 0.9,
        },
        {
          rule: 'Hallucinated — first line absent from file',
          evidence_path: 'src/api.ts',
          evidence_snippet: 'this line was made up by the LLM!!!\nconst x = 1;',
          confidence: 0.95,
        },
      ]);

      const app = await makeApp({ llm: { openrouter: llm } });
      const res = await app.inject({ method: 'POST', url: `/repos/${cloneRepoId}/conventions/rescan` });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.candidates).toHaveLength(1);
      expect(body.candidates[0].rule).toBe('Real rule — first line exists in file');
      await app.close();
    });

    it('drops candidates with confidence ≤ 0.6', async () => {
      const llm = makeLlm([
        {
          rule: 'Low confidence rule',
          evidence_path: 'src/api.ts',
          evidence_snippet: FIXTURE_CODE,
          confidence: 0.5,
        },
      ]);

      const app = await makeApp({ llm: { openrouter: llm } });
      const res = await app.inject({ method: 'POST', url: `/repos/${cloneRepoId}/conventions/rescan` });
      expect(res.statusCode).toBe(200);
      expect(res.json().candidates).toHaveLength(0);
      await app.close();
    });

    it('subsequent rescan replaces previous conventions; GET reflects new set', async () => {
      const first = makeLlm([
        {
          rule: 'First scan rule',
          evidence_path: 'src/api.ts',
          evidence_snippet: FIXTURE_CODE,
          confidence: 0.9,
        },
      ]);
      const second = makeLlm([
        {
          rule: 'Second scan rule — replaces first',
          evidence_path: 'src/api.ts',
          evidence_snippet: FIXTURE_CODE,
          confidence: 0.88,
        },
      ]);

      const app1 = await makeApp({ llm: { openrouter: first } });
      await app1.inject({ method: 'POST', url: `/repos/${cloneRepoId}/conventions/rescan` });
      await app1.close();

      const app2 = await makeApp({ llm: { openrouter: second } });
      const res2 = await app2.inject({ method: 'POST', url: `/repos/${cloneRepoId}/conventions/rescan` });
      expect(res2.statusCode).toBe(200);
      expect(res2.json().candidates).toHaveLength(1);
      expect(res2.json().candidates[0].rule).toBe('Second scan rule — replaces first');

      // GET must now return only the second-scan candidate.
      const listRes = await app2.inject({ method: 'GET', url: `/repos/${cloneRepoId}/conventions` });
      const listed = listRes.json();
      expect(listed).toHaveLength(1);
      expect(listed[0].rule).toBe('Second scan rule — replaces first');

      await app2.close();
    });
  });
});
