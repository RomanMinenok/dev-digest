import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { seed } from '../../db/seed.js';
import * as t from '../../db/schema.js';
import { MockGitClient, MockGitHubClient, MockLLMProvider } from '../../adapters/mocks.js';
import type { ContainerOverrides } from '../../platform/container.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[intent] Docker not available — skipping integration tests.');
}

const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

const INTENT_FIXTURE = {
  intent: 'Add rate limiting to the public API.',
  in_scope: ['token bucket limiter middleware'],
  out_of_scope: ['does not address the admin API'],
};

d('Intent module (Testcontainers pg)', () => {
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
      .values({ workspaceId, owner: 'acme', name: 'intent-it', fullName: 'acme/intent-it' })
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
        git: new MockGitClient({ diff: DIFF }),
        github: new MockGitHubClient({ detail: { body: null, linked_issue: null } }),
        llm: { openrouter: new MockLLMProvider('openai', { structured: INTENT_FIXTURE }) },
        ...overrides,
      },
    });
  }

  async function setupPr(headSha = 'sha1', title = 'Add rate limiting', body: string | null = null) {
    const number = ++repoSeq;
    const [pull] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number,
        title,
        author: 'a',
        branch: 'b',
        base: 'main',
        headSha,
        status: 'needs_review',
        body,
      })
      .returning();
    return pull!;
  }

  it('GET computes and persists intent on first call', async () => {
    const app = await makeApp();
    const pr = await setupPr();

    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/intent` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.pr_id).toBe(pr.id);
    expect(body.intent).toBe(INTENT_FIXTURE.intent);
    expect(body.in_scope).toEqual(INTENT_FIXTURE.in_scope);
    expect(body.out_of_scope).toEqual(INTENT_FIXTURE.out_of_scope);
    expect(body.model).toBe('deepseek/deepseek-v4-flash');
    expect(body.head_sha).toBe('sha1');

    const [row] = await pg.handle.db.select().from(t.prIntent).where(eq(t.prIntent.prId, pr.id));
    expect(row).toBeDefined();
    expect(row!.model).toBe('deepseek/deepseek-v4-flash');
    expect(row!.headSha).toBe('sha1');

    await app.close();
  });

  it('second GET returns the cached row without recomputing', async () => {
    const llm = new MockLLMProvider('openai', { structured: INTENT_FIXTURE });
    const app = await makeApp({ llm: { openrouter: llm } });
    const pr = await setupPr();

    await app.inject({ method: 'GET', url: `/pulls/${pr.id}/intent` });
    const callsAfterFirst = llm.calls.filter((c) => c.method === 'completeStructured').length;

    const res2 = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/intent` });
    expect(res2.statusCode).toBe(200);
    const callsAfterSecond = llm.calls.filter((c) => c.method === 'completeStructured').length;

    expect(callsAfterSecond).toBe(callsAfterFirst);
    await app.close();
  });

  it('stale head_sha does NOT trigger auto-recompute on GET — cached row is returned as-is', async () => {
    const app = await makeApp();
    const pr = await setupPr('sha-old');

    const first = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/intent` });
    expect(first.json().head_sha).toBe('sha-old');

    // Simulate a new commit landing on the PR.
    await pg.handle.db.update(t.pullRequests).set({ headSha: 'sha-new' }).where(eq(t.pullRequests.id, pr.id));

    const second = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/intent` });
    expect(second.statusCode).toBe(200);
    expect(second.json().head_sha).toBe('sha-old');

    // Only the manual recompute trigger refreshes a stale row.
    const recompute = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/intent/recompute` });
    expect(recompute.statusCode).toBe(200);
    expect(recompute.json().head_sha).toBe('sha-new');

    await app.close();
  });

  it('POST recompute always overwrites and bumps updated_at', async () => {
    const app = await makeApp();
    const pr = await setupPr();

    const first = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/intent` });
    const firstUpdatedAt = first.json().updated_at;

    await new Promise((r) => setTimeout(r, 5));

    const recompute = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/intent/recompute` });
    expect(recompute.statusCode).toBe(200);
    expect(new Date(recompute.json().updated_at).getTime()).toBeGreaterThan(new Date(firstUpdatedAt).getTime());

    await app.close();
  });

  it('logs positive token savings numbers', async () => {
    const app = await makeApp();
    const pr = await setupPr();

    const logs: { obj: unknown; msg: string }[] = [];
    (app.log as unknown as { info: (obj: unknown, msg: string) => void }).info = (obj, msg) => {
      logs.push({ obj, msg });
    };

    await app.inject({ method: 'GET', url: `/pulls/${pr.id}/intent` });

    const savingsLog = logs.find((l) => l.msg === 'intent: computed');
    expect(savingsLog).toBeDefined();
    const payload = savingsLog!.obj as { savedTokens: number; fullDiffTokens: number; headerTokens: number };
    expect(payload.savedTokens).toBeGreaterThanOrEqual(0);
    expect(payload.fullDiffTokens).toBeGreaterThan(0);
    expect(payload.headerTokens).toBeGreaterThan(0);

    await app.close();
  });

  it('a PR with no body / no linked issue / no spec still yields a stored intent (graceful degradation)', async () => {
    const app = await makeApp({
      github: new MockGitHubClient({ detail: { body: null, linked_issue: null, files: [] } }),
    });
    const pr = await setupPr('sha1', 'Fix a small bug', null);

    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/intent` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.intent).toBe(INTENT_FIXTURE.intent);

    await app.close();
  });

  it('POST recompute on a PR with no prior stored intent computes one', async () => {
    const app = await makeApp();
    const pr = await setupPr();

    const res = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/intent/recompute` });
    expect(res.statusCode).toBe(200);
    expect(res.json().intent).toBe(INTENT_FIXTURE.intent);

    await app.close();
  });
});
