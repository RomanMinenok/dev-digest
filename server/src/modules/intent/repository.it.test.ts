import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { seed } from '../../db/seed.js';
import * as t from '../../db/schema.js';
import { IntentRepository } from './repository.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[intent] Docker not available — skipping integration tests.');
}

d('IntentRepository (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let prId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces).where(eq(t.workspaces.name, 'default'));
    workspaceId = ws!.id;

    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'intent-repo', fullName: 'acme/intent-repo' })
      .returning();

    const [pull] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 1,
        title: 'Add rate limiting',
        author: 'a',
        branch: 'b',
        base: 'main',
        headSha: 'sha1',
        status: 'needs_review',
      })
      .returning();
    prId = pull!.id;
  });

  afterAll(async () => {
    await pg?.stop();
  });

  it('upsert inserts a new row with all fields', async () => {
    const repo = new IntentRepository(pg.handle.db);
    const row = await repo.upsert(prId, {
      intent: 'Add rate limiting to the public API',
      inScope: ['token bucket middleware'],
      outOfScope: ['does not touch admin API'],
      model: 'deepseek/deepseek-v4-flash',
      headSha: 'sha1',
      sources: [{ type: 'linked_issue', ref: '#471', included: true }],
    });

    expect(row.prId).toBe(prId);
    expect(row.intent).toBe('Add rate limiting to the public API');
    expect(row.inScope).toEqual(['token bucket middleware']);
    expect(row.outOfScope).toEqual(['does not touch admin API']);
    expect(row.model).toBe('deepseek/deepseek-v4-flash');
    expect(row.headSha).toBe('sha1');
    expect(row.sources).toEqual([{ type: 'linked_issue', ref: '#471', included: true }]);
  });

  it('get returns the persisted row', async () => {
    const repo = new IntentRepository(pg.handle.db);
    const row = await repo.get(prId);
    expect(row).toBeDefined();
    expect(row!.prId).toBe(prId);
  });

  it('get returns undefined for a PR with no stored intent', async () => {
    const repo = new IntentRepository(pg.handle.db);
    const row = await repo.get('00000000-0000-0000-0000-000000000000');
    expect(row).toBeUndefined();
  });

  it('upsert on conflict REPLACES every column — regression for the onConflictDoUpdate footgun (server/INSIGHTS.md)', async () => {
    const repo = new IntentRepository(pg.handle.db);

    await repo.upsert(prId, {
      intent: 'first intent',
      inScope: ['a'],
      outOfScope: ['b'],
      model: 'model-a',
      headSha: 'sha1',
      sources: [{ type: 'pr_body', ref: 'body', included: true }],
    });

    const firstUpdatedAt = (await repo.get(prId))!.updatedAt.getTime();
    await new Promise((r) => setTimeout(r, 5));

    const second = await repo.upsert(prId, {
      intent: 'second intent — completely different',
      inScope: ['c', 'd'],
      outOfScope: ['e'],
      model: 'model-b',
      headSha: 'sha2',
      sources: [{ type: 'repo_md', ref: 'docs/plan/x.md', included: true }],
    });

    // Every column from the second call must win — none stay stale from the first.
    expect(second.intent).toBe('second intent — completely different');
    expect(second.inScope).toEqual(['c', 'd']);
    expect(second.outOfScope).toEqual(['e']);
    expect(second.model).toBe('model-b');
    expect(second.headSha).toBe('sha2');
    expect(second.sources).toEqual([{ type: 'repo_md', ref: 'docs/plan/x.md', included: true }]);
    expect(second.updatedAt.getTime()).toBeGreaterThan(firstUpdatedAt);

    const reread = await repo.get(prId);
    expect(reread!.intent).toBe('second intent — completely different');
    expect(reread!.headSha).toBe('sha2');
  });

  it('getPullAndRepo returns the workspace-scoped pull + repo pair', async () => {
    const repo = new IntentRepository(pg.handle.db);
    const found = await repo.getPullAndRepo(workspaceId, prId);
    expect(found).toBeDefined();
    expect(found!.pull.id).toBe(prId);
    expect(found!.repo.fullName).toBe('acme/intent-repo');
  });

  it('getPullAndRepo returns undefined for a cross-tenant PR (workspace scoping)', async () => {
    const [otherWs] = await pg.handle.db.insert(t.workspaces).values({ name: 'other-intent-ws' }).returning();
    const repo = new IntentRepository(pg.handle.db);
    const found = await repo.getPullAndRepo(otherWs!.id, prId);
    expect(found).toBeUndefined();
  });
});
