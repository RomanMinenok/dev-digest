import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { seed } from '../../db/seed.js';
import * as t from '../../db/schema.js';
import { ConventionsRepository } from './repository.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[conventions] Docker not available — skipping integration tests.');
}

d('ConventionsRepository (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let repoId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces).where(eq(t.workspaces.name, 'default'));
    workspaceId = ws!.id;

    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'test',
        name: 'test-repo',
        fullName: 'test/test-repo',
        createdBy: 'system',
      })
      .returning();
    repoId = repo!.id;
  });

  afterAll(async () => {
    await pg?.stop();
  });

  it('replaceAll inserts drafts with accepted=false', async () => {
    const repo = new ConventionsRepository(pg.handle.db);

    const rows = await repo.replaceAll(workspaceId, repoId, [
      {
        rule: 'Always use async/await',
        evidence_path: 'src/api.ts',
        evidence_snippet: 'const x = await foo();',
        confidence: 0.9,
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.rule).toBe('Always use async/await');
    expect(rows[0]!.accepted).toBe(false);
    expect(rows[0]!.workspaceId).toBe(workspaceId);
    expect(rows[0]!.repoId).toBe(repoId);
  });

  it('replaceAll is idempotent — old rows deleted, new rows inserted', async () => {
    const repo = new ConventionsRepository(pg.handle.db);

    await repo.replaceAll(workspaceId, repoId, [
      {
        rule: 'First rule',
        evidence_path: 'src/a.ts',
        evidence_snippet: 'const a = 1;',
        confidence: 0.8,
      },
    ]);

    const second = await repo.replaceAll(workspaceId, repoId, [
      {
        rule: 'Second rule',
        evidence_path: 'src/b.ts',
        evidence_snippet: 'const b = 2;',
        confidence: 0.75,
      },
    ]);

    const listed = await repo.listForRepo(workspaceId, repoId);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.rule).toBe('Second rule');
    expect(second[0]!.rule).toBe('Second rule');
  });

  it('replaceAll with empty drafts deletes all rows and returns []', async () => {
    const repo = new ConventionsRepository(pg.handle.db);

    await repo.replaceAll(workspaceId, repoId, [
      {
        rule: 'Some rule',
        evidence_path: 'src/c.ts',
        evidence_snippet: 'const c = 3;',
        confidence: 0.9,
      },
    ]);

    const result = await repo.replaceAll(workspaceId, repoId, []);
    expect(result).toHaveLength(0);

    const listed = await repo.listForRepo(workspaceId, repoId);
    expect(listed).toHaveLength(0);
  });
});
