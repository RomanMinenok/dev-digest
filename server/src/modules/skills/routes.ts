import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillSource, SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { BadRequestError, NotFoundError } from '../../platform/errors.js';
import { SkillsService } from './service.js';
import { ACCEPTED_IMPORT_EXTENSIONS } from './constants.js';

/** `/skills/:id/versions/:version` — id is a uuid, version a positive integer. */
const VersionParams = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().positive(),
});

const CreateSkillBody = z.object({
  name: z.string().min(1),
  description: z.string(),
  type: SkillType,
  body: z.string().min(1),
  source: SkillSource.optional(),
  enabled: z.boolean().optional(),
  summary: z.string().optional(),
});

const UpdateSkillBody = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    type: SkillType.optional(),
    body: z.string().min(1).optional(),
    enabled: z.boolean().optional(),
    summary: z.string().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });

/**
 * Skills module — CRUD + immutable body versions + usage stats + import preview.
 *   GET    /skills                          → list (workspace-scoped)
 *   GET    /skills/:id                       → one skill
 *   POST   /skills                          → create (201)
 *   PUT    /skills/:id                       → update / toggle (versions on body change)
 *   DELETE /skills/:id                       → delete (cascade versions + links)
 *   GET    /skills/:id/versions             → body history (newest first)
 *   GET    /skills/:id/versions/:version    → one snapshot
 *   POST   /skills/:id/restore/:version     → restore a version (writes a new one)
 *   GET    /skills/:id/stats                → usage stats (real used_by + placeholders)
 *   POST   /skills/import/preview           → extract a skill from an upload (no persist)
 */
export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(app.container);

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.post('/skills', { schema: { body: CreateSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const body = req.body;
    const skill = await service.create(workspaceId, {
      name: body.name,
      description: body.description,
      type: body.type,
      body: body.body,
      ...(body.source !== undefined ? { source: body.source } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.summary !== undefined ? { summary: body.summary } : {}),
    });
    reply.status(201);
    return skill;
  });

  app.put('/skills/:id', { schema: { params: IdParams, body: UpdateSkillBody } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.update(workspaceId, req.params.id, req.body);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const ok = await service.delete(workspaceId, req.params.id);
    if (!ok) throw new NotFoundError('Skill not found');
    return { ok: true };
  });

  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const versions = await service.listVersions(workspaceId, req.params.id);
    if (!versions) throw new NotFoundError('Skill not found');
    return versions;
  });

  app.get(
    '/skills/:id/versions/:version',
    { schema: { params: VersionParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const version = await service.getVersion(workspaceId, req.params.id, req.params.version);
      if (!version) throw new NotFoundError('Skill version not found');
      return version;
    },
  );

  app.post(
    '/skills/:id/restore/:version',
    { schema: { params: VersionParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.restore(workspaceId, req.params.id, req.params.version);
      if (!skill) throw new NotFoundError('Skill version not found');
      return skill;
    },
  );

  app.get('/skills/:id/stats', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const stats = await service.stats(workspaceId, req.params.id);
    if (!stats) throw new NotFoundError('Skill not found');
    return stats;
  });

  // Multipart upload — no Zod body schema (the body is a file stream). The file
  // is read via req.file(); presence + extension are validated here as 400s.
  app.post('/skills/import/preview', async (req) => {
    await getContext(app.container, req);
    // req.file() throws when the request isn't multipart (e.g. no body at all);
    // treat any "no usable file" condition as a 400 rather than leaking the
    // plugin's 406/415.
    let part;
    try {
      part = await req.file();
    } catch {
      throw new BadRequestError('Expected a multipart file upload');
    }
    if (!part) throw new BadRequestError('No file uploaded');

    const filename = part.filename ?? '';
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    if (!(ACCEPTED_IMPORT_EXTENSIONS as readonly string[]).includes(ext)) {
      throw new BadRequestError(
        `Unsupported file type. Accepted: ${ACCEPTED_IMPORT_EXTENSIONS.join(', ')}`,
      );
    }

    const buffer = await part.toBuffer();
    return service.importPreview({ filename, buffer });
  });
}
