import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { EvalService } from './service.js';

const CreateCaseBody = z.object({
  name: z.string().min(1),
  input_diff: z.string().optional(),
  input_files: z.unknown().optional(),
  input_meta: z.unknown().optional(),
  expected_output: z.unknown().optional(),
  notes: z.string().nullish(),
});

const UpdateCaseBody = z.object({
  name: z.string().min(1).optional(),
  input_diff: z.string().nullable().optional(),
  input_files: z.unknown().optional(),
  input_meta: z.unknown().optional(),
  expected_output: z.unknown().optional(),
  notes: z.string().nullish(),
});

const RunCasesBody = z.object({
  case_ids: z.array(z.string().uuid()).optional(),
});

/**
 * Eval module routes (SPEC-03, T14).
 *
 *   GET    /agents/:id/eval-cases     → list cases + latest run per case
 *   POST   /agents/:id/eval-cases     → create eval case (201)
 *   PUT    /eval-cases/:id            → patch eval case
 *   DELETE /eval-cases/:id            → delete eval case and its runs
 *   POST   /agents/:id/eval-runs      → run cases sequentially (all or subset)
 *   GET    /agents/:id/eval-dashboard → dashboard aggregate
 */
export default async function evalRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new EvalService(app.container);

  app.get('/agents/:id/eval-cases', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId, req.params.id);
  });

  app.post(
    '/agents/:id/eval-cases',
    { schema: { params: IdParams, body: CreateCaseBody } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const evalCase = await service.create(workspaceId, req.params.id, req.body);
      reply.status(201);
      return evalCase;
    },
  );

  app.put(
    '/eval-cases/:id',
    { schema: { params: IdParams, body: UpdateCaseBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const evalCase = await service.update(workspaceId, req.params.id, req.body);
      if (!evalCase) throw new NotFoundError('Eval case not found');
      return evalCase;
    },
  );

  app.delete('/eval-cases/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    await service.delete(workspaceId, req.params.id);
    return { ok: true };
  });

  app.post(
    '/agents/:id/eval-runs',
    { schema: { params: IdParams, body: RunCasesBody }, config: { timeout: 300_000 } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.runCases(workspaceId, req.params.id, req.body.case_ids);
    },
  );

  app.get('/agents/:id/eval-dashboard', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.dashboard(workspaceId, req.params.id);
  });
}
