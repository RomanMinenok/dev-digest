import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { waitForPrRuns } from '../../../test/helpers/runs.js';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { seed } from '../../db/seed.js';
import { MockLLMProvider, MockEmbedder, MockGitClient } from '../../adapters/mocks.js';
import * as t from '../../db/schema.js';
import { SkillsRepository } from '../skills/repository.js';
import { AgentsRepository } from '../agents/repository.js';
import type { Review } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[run-executor-skills] Docker not available — skipping integration tests.');
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

let repoSeq = 0;
async function setupPr(db: PgFixture['handle']['db'], workspaceId: string) {
  const name = `skills-run-${repoSeq++}`;
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();
  const [pr] = await db
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
  await db.insert(t.prFiles).values({
    prId: pr!.id,
    path: 'src/config.ts',
    additions: 1,
    deletions: 0,
    patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
  });
  return pr!;
}

/**
 * Phase 3 keystone — the run executor injects ONLY linked + globally-enabled
 * skill bodies (in link order) into the engine prompt. We observe the effect via
 * the persisted run trace's `prompt_assembly.skills` block (the engine joins the
 * skill bodies into that block, or leaves it null when there are none).
 */
d('RunExecutor — skill injection (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

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
      // repo-intel off so the only optional prompt section is skills
      repoIntel: false,
    });
  }

  async function makeSkill(name: string, body: string, enabled: boolean) {
    return new SkillsRepository(pg.handle.db).insert({
      workspaceId,
      name,
      description: 'd',
      type: 'rubric',
      body,
      enabled,
    });
  }

  async function runAndGetTrace(app: Awaited<ReturnType<typeof makeApp>>, agentId: string, prId: string) {
    const body = (
      await app.inject({ method: 'POST', url: `/pulls/${prId}/review`, payload: { agentId } })
    ).json();
    const runId = body.runs[0].run_id as string;
    await waitForPrRuns(pg.handle.db, prId, { expected: 1 });
    return (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
  }

  it('injects only enabled linked skills, in link order', async () => {
    const app = await makeApp();
    const agent = await makeAgent('Skill Agent');
    const enabled = await makeSkill('Enabled Rule', 'ENABLED-BODY', true);
    const disabled = await makeSkill('Disabled Rule', 'DISABLED-BODY', false);
    const agentsRepo = new AgentsRepository(pg.handle.db);
    // link disabled first, enabled second — only the enabled body should appear.
    await agentsRepo.setSkills(agent.id, [disabled.id, enabled.id]);

    const pr = await setupPr(pg.handle.db, workspaceId);
    const trace = await runAndGetTrace(app, agent.id, pr.id);

    expect(trace.prompt_assembly.skills).toContain('ENABLED-BODY');
    expect(trace.prompt_assembly.skills).not.toContain('DISABLED-BODY');
    // run log notes the single injected skill
    expect(trace.log.some((l: { msg: string }) => /Injected 1 enabled skill/.test(l.msg))).toBe(true);
    await app.close();
  });

  it('preserves link order across two enabled skills', async () => {
    const app = await makeApp();
    const agent = await makeAgent('Ordered Agent');
    const first = await makeSkill('First', 'FIRST-BODY', true);
    const second = await makeSkill('Second', 'SECOND-BODY', true);
    await new AgentsRepository(pg.handle.db).setSkills(agent.id, [first.id, second.id]);

    const pr = await setupPr(pg.handle.db, workspaceId);
    const trace = await runAndGetTrace(app, agent.id, pr.id);
    const skillsBlock: string = trace.prompt_assembly.skills;
    expect(skillsBlock.indexOf('FIRST-BODY')).toBeLessThan(skillsBlock.indexOf('SECOND-BODY'));
    await app.close();
  });

  it('omits the skills block when no enabled skill is linked', async () => {
    const app = await makeApp();
    const agent = await makeAgent('No Skill Agent');
    const disabled = await makeSkill('Only Disabled', 'DISABLED-ONLY', false);
    await new AgentsRepository(pg.handle.db).setSkills(agent.id, [disabled.id]);

    const pr = await setupPr(pg.handle.db, workspaceId);
    const trace = await runAndGetTrace(app, agent.id, pr.id);
    expect(trace.prompt_assembly.skills).toBeNull();
    await app.close();
  });
});
