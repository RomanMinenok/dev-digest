import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { waitForPrRuns } from '../../../test/helpers/runs.js';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { seed } from '../../db/seed.js';
import { MockLLMProvider, MockEmbedder, MockGitClient } from '../../adapters/mocks.js';
import * as t from '../../db/schema.js';
import { AgentsRepository } from '../agents/repository.js';
import { IntentRepository } from '../intent/repository.js';
import type { Review } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[run-executor-intent] Docker not available — skipping integration tests.');
}

const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

const REVIEW_FIXTURE: Review = {
  verdict: 'comment',
  summary: 'ok',
  score: 90,
  findings: [],
};

/**
 * Phase 7 keystone — run-executor reads the PR's already-STORED intent
 * (never computes it) and injects it into the engine prompt. Observed via the
 * persisted run trace's `prompt_assembly.intent` block.
 */
d('RunExecutor — declared intent injection (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let repoSeq = 0;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces).where(eq(t.workspaces.name, 'default'));
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    return buildApp({
      config: loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: DIFF }),
        llm: { openai: new MockLLMProvider('openai', { structured: REVIEW_FIXTURE }) },
      },
    });
  }

  async function makeAgent(name: string) {
    const repo = new AgentsRepository(pg.handle.db);
    return repo.insert({
      workspaceId,
      name,
      provider: 'openai',
      model: 'gpt-4.1',
      systemPrompt: 'review',
      repoIntel: false,
    });
  }

  async function setupPr() {
    const name = `intent-run-${repoSeq++}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 1,
        title: 'x',
        author: 'a',
        branch: 'b',
        base: 'main',
        headSha: 'sha',
        additions: 1,
        deletions: 0,
        filesCount: 1,
        status: 'needs_review',
      })
      .returning();
    await pg.handle.db.insert(t.prFiles).values({
      prId: pr!.id,
      path: 'src/config.ts',
      additions: 1,
      deletions: 0,
      patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
    });
    return pr!;
  }

  async function runAndGetTrace(app: Awaited<ReturnType<typeof makeApp>>, agentId: string, prId: string) {
    const body = (
      await app.inject({ method: 'POST', url: `/pulls/${prId}/review`, payload: { agentId } })
    ).json();
    const runId = body.runs[0].run_id as string;
    await waitForPrRuns(pg.handle.db, prId, { expected: 1 });
    return (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
  }

  it('injects the stored intent + scope rule into the prompt when present', async () => {
    const app = await makeApp();
    const agent = await makeAgent('Intent Agent');
    const pr = await setupPr();

    const intentRepo = new IntentRepository(pg.handle.db);
    await intentRepo.upsert(pr.id, {
      intent: 'Add rate limiting to the public API.',
      inScope: ['token bucket limiter middleware'],
      outOfScope: ['does not address the admin API'],
      model: 'deepseek/deepseek-v4-flash',
      headSha: 'sha',
      sources: [],
    });

    const trace = await runAndGetTrace(app, agent.id, pr.id);

    expect(trace.prompt_assembly.intent).toContain('Add rate limiting to the public API.');
    expect(trace.prompt_assembly.intent).toContain('token bucket limiter middleware');
    expect(trace.prompt_assembly.intent).toMatch(/Do not comment outside the/);
    expect(trace.log.some((l: { msg: string }) => /Injected declared intent/.test(l.msg))).toBe(true);

    await app.close();
  });

  it('produces an identical (null intent) prompt block when no intent is stored', async () => {
    const app = await makeApp();
    const agent = await makeAgent('No Intent Agent');
    const pr = await setupPr();

    const trace = await runAndGetTrace(app, agent.id, pr.id);

    expect(trace.prompt_assembly.intent).toBeNull();
    expect(trace.log.some((l: { msg: string }) => /Injected declared intent/.test(l.msg))).toBe(false);

    await app.close();
  });
});
