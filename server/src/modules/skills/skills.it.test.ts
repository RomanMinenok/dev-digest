import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import AdmZip from 'adm-zip';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { seed } from '../../db/seed.js';
import * as t from '../../db/schema.js';
import { MockGitClient, MockGitHubClient } from '../../adapters/mocks.js';
import { SkillsRepository } from './repository.js';
import { SkillsService } from './service.js';
import { AgentsRepository } from '../agents/repository.js';
import type { Container } from '../../platform/container.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

/**
 * Build a single-file multipart/form-data body by hand (no form-data dep) so the
 * import route can be exercised via app.inject().
 */
function multipart(
  filename: string,
  content: Buffer,
  contentType: string,
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = '----devdigesttest' + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, content, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

/**
 * Skills module — repository CRUD/versioning/cascade, service import/stats, and
 * the route layer (status codes + workspace scoping). Mirrors the agents +
 * reviews integration test style (Testcontainers Postgres, app.inject()).
 */
d('Skills module (Testcontainers pg)', () => {
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
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  }

  // ---- repository --------------------------------------------------------

  describe('SkillsRepository', () => {
    it('insert snapshots v1; body change bumps + snapshots, non-body does not', async () => {
      const repo = new SkillsRepository(pg.handle.db);
      const created = await repo.insert({
        workspaceId,
        name: 'Repo Skill',
        description: 'd',
        type: 'rubric',
        body: 'original body',
        summary: 'Initial',
      });
      expect(created.version).toBe(1);
      expect(await repo.listVersions(created.id)).toHaveLength(1);

      // Non-body change (enabled, name) does NOT bump.
      const toggled = await repo.update(workspaceId, created.id, {
        enabled: false,
        name: 'Renamed',
      });
      expect(toggled!.version).toBe(1);
      expect(await repo.listVersions(created.id)).toHaveLength(1);

      // Body change bumps to v2 and writes a snapshot.
      const edited = await repo.update(workspaceId, created.id, {
        body: 'new body',
        summary: 'Edit',
      });
      expect(edited!.version).toBe(2);
      const versions = await repo.listVersions(created.id);
      expect(versions.map((v) => v.version)).toEqual([2, 1]);
      expect(versions[0]!.body).toBe('new body');
      expect(versions[0]!.summary).toBe('Edit');
    });

    it('deleteById cascades skill_versions and agent_skills', async () => {
      const repo = new SkillsRepository(pg.handle.db);
      const agentsRepo = new AgentsRepository(pg.handle.db);
      const skill = await repo.insert({
        workspaceId,
        name: 'Cascade Skill',
        description: 'd',
        type: 'custom',
        body: 'b',
      });
      await repo.update(workspaceId, skill.id, { body: 'b2' }); // -> v2 snapshot
      const agent = await agentsRepo.insert({
        workspaceId,
        name: 'Linker',
        provider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: 'x',
      });
      await agentsRepo.linkSkill(agent.id, skill.id, 0);
      expect(await repo.usedBy(skill.id)).toHaveLength(1);

      expect(await repo.deleteById(workspaceId, skill.id)).toBe(true);
      // versions gone
      expect(await repo.listVersions(skill.id)).toHaveLength(0);
      // agent_skills link gone
      const links = await pg.handle.db
        .select()
        .from(t.agentSkills)
        .where(eq(t.agentSkills.skillId, skill.id));
      expect(links).toHaveLength(0);
    });

    it('usedBy returns the linking agents', async () => {
      const repo = new SkillsRepository(pg.handle.db);
      const agentsRepo = new AgentsRepository(pg.handle.db);
      const skill = await repo.insert({
        workspaceId,
        name: 'Used Skill',
        description: 'd',
        type: 'custom',
        body: 'b',
      });
      const a1 = await agentsRepo.insert({
        workspaceId,
        name: 'UB Agent',
        provider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: 'x',
      });
      await agentsRepo.linkSkill(a1.id, skill.id, 0);
      const used = await repo.usedBy(skill.id);
      expect(used).toEqual([{ id: a1.id, name: 'UB Agent' }]);
    });
  });

  // ---- service -----------------------------------------------------------

  describe('SkillsService', () => {
    function svc() {
      return new SkillsService({ db: pg.handle.db } as unknown as Container);
    }

    it('create defaults source=manual, enabled=true', async () => {
      const skill = await svc().create(workspaceId, {
        name: 'Defaulted',
        description: 'd',
        type: 'rubric',
        body: 'b',
      });
      expect(skill.source).toBe('manual');
      expect(skill.enabled).toBe(true);
    });

    it('restore loads a version body and writes a new version', async () => {
      const service = svc();
      const skill = await service.create(workspaceId, {
        name: 'Restorable',
        description: 'd',
        type: 'custom',
        body: 'v1 body',
      });
      await service.update(workspaceId, skill.id, { body: 'v2 body' }); // -> v2
      const restored = await service.restore(workspaceId, skill.id, 1);
      expect(restored!.version).toBe(3);
      expect(restored!.body).toBe('v1 body');
      const versions = await service.listVersions(workspaceId, skill.id);
      expect(versions!.map((v) => v.version)).toEqual([3, 2, 1]);
      expect(versions![0]!.summary).toBe('Restored v1');
    });

    it('stats returns real used_by + null placeholders', async () => {
      const service = svc();
      const skill = await service.create(workspaceId, {
        name: 'Stat Skill',
        description: 'd',
        type: 'custom',
        body: 'b',
      });
      const stats = await service.stats(workspaceId, skill.id);
      expect(stats).toMatchObject({
        skill_id: skill.id,
        used_by: 0,
        agents: [],
        pull_rate: null,
        accept_rate: null,
        findings_30d: null,
        findings_by_category: null,
      });
    });

    it('importPreview extracts a .md core', () => {
      const ex = svc().importPreview({
        filename: 'rule.md',
        buffer: Buffer.from('---\nname: MD Skill\n---\n# H\n\nrule'),
      });
      expect(ex).toMatchObject({ name: 'MD Skill', source: 'extracted' });
    });

    it('importPreview extracts a .zip core and ignores a .sh entry', () => {
      const zip = new AdmZip();
      zip.addFile('SKILL.md', Buffer.from('# Zip Skill\n\nbody'));
      zip.addFile('run.sh', Buffer.from('echo x'));
      const ex = svc().importPreview({ filename: 'pack.zip', buffer: zip.toBuffer() });
      expect(ex.name).toBe('Zip Skill');
      expect(ex.body).not.toContain('echo x');
    });

    it('importPreview throws BadRequestError for a zip with no markdown', () => {
      const zip = new AdmZip();
      zip.addFile('only.sh', Buffer.from('echo x'));
      expect(() => svc().importPreview({ filename: 'p.zip', buffer: zip.toBuffer() })).toThrow();
    });
  });

  // ---- routes ------------------------------------------------------------

  describe('routes', () => {
    const createBody = {
      name: 'Route Skill',
      description: 'desc',
      type: 'rubric' as const,
      body: 'route body',
    };

    it('full CRUD + versioning lifecycle via HTTP', async () => {
      const app = await makeApp();

      const created = await app.inject({ method: 'POST', url: '/skills', payload: createBody });
      expect(created.statusCode).toBe(201);
      const skill = created.json();
      expect(skill.version).toBe(1);
      expect(skill.source).toBe('manual');

      const got = await app.inject({ method: 'GET', url: `/skills/${skill.id}` });
      expect(got.statusCode).toBe(200);

      const list = (await app.inject({ method: 'GET', url: '/skills' })).json();
      expect(list.some((s: { id: string }) => s.id === skill.id)).toBe(true);

      // body change -> v2
      const updated = await app.inject({
        method: 'PUT',
        url: `/skills/${skill.id}`,
        payload: { body: 'edited body', summary: 'Edit one' },
      });
      expect(updated.json().version).toBe(2);

      const versions = (await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions` })).json();
      expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);

      // restore v1 -> v3
      const restored = await app.inject({
        method: 'POST',
        url: `/skills/${skill.id}/restore/1`,
      });
      expect(restored.statusCode).toBe(200);
      expect(restored.json().version).toBe(3);

      // stats
      const stats = (await app.inject({ method: 'GET', url: `/skills/${skill.id}/stats` })).json();
      expect(stats.used_by).toBe(0);
      expect(stats.pull_rate).toBeNull();

      // delete
      const del = await app.inject({ method: 'DELETE', url: `/skills/${skill.id}` });
      expect(del.statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: `/skills/${skill.id}` })).statusCode).toBe(404);
      await app.close();
    });

    it('404s for unknown skill on get/update/delete/versions/stats', async () => {
      const app = await makeApp();
      const ghost = '00000000-0000-0000-0000-000000000000';
      expect((await app.inject({ method: 'GET', url: `/skills/${ghost}` })).statusCode).toBe(404);
      expect(
        (await app.inject({ method: 'PUT', url: `/skills/${ghost}`, payload: { name: 'x' } })).statusCode,
      ).toBe(404);
      expect((await app.inject({ method: 'DELETE', url: `/skills/${ghost}` })).statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url: `/skills/${ghost}/versions` })).statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url: `/skills/${ghost}/stats` })).statusCode).toBe(404);
      await app.close();
    });

    it('a skill in another workspace is invisible (404) to the default tenant', async () => {
      const app = await makeApp();
      const [otherWs] = await pg.handle.db.insert(t.workspaces).values({ name: 'other-skills' }).returning();
      const foreign = await new SkillsRepository(pg.handle.db).insert({
        workspaceId: otherWs!.id,
        name: 'Foreign Skill',
        description: 'd',
        type: 'custom',
        body: 'b',
      });
      // The request context resolves to the default workspace → cross-tenant 404.
      expect((await app.inject({ method: 'GET', url: `/skills/${foreign.id}` })).statusCode).toBe(404);
      expect(
        (await app.inject({ method: 'GET', url: `/skills/${foreign.id}/versions` })).statusCode,
      ).toBe(404);
      const list = (await app.inject({ method: 'GET', url: '/skills' })).json();
      expect(list.some((s: { id: string }) => s.id === foreign.id)).toBe(false);
      await app.close();
    });

    it('import/preview: missing file → 400; unsupported ext → 400; .md → extracted', async () => {
      const app = await makeApp();

      // No multipart body at all → BadRequestError (400).
      const noFile = await app.inject({ method: 'POST', url: '/skills/import/preview' });
      expect(noFile.statusCode).toBe(400);

      // Unsupported extension.
      const badExt = multipart('pic.png', Buffer.from('x'), 'image/png');
      const badRes = await app.inject({
        method: 'POST',
        url: '/skills/import/preview',
        payload: badExt.payload,
        headers: badExt.headers,
      });
      expect(badRes.statusCode).toBe(400);

      // Valid markdown.
      const md = multipart(
        'rule.md',
        Buffer.from('---\nname: Imported\n---\n# H\n\nrule'),
        'text/markdown',
      );
      const ok = await app.inject({
        method: 'POST',
        url: '/skills/import/preview',
        payload: md.payload,
        headers: md.headers,
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toMatchObject({ name: 'Imported', source: 'extracted' });
      await app.close();
    });
  });
});
