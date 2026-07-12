import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { BlastService } from './service.js';

/**
 * Blast Radius routes (docs/plan/blast_radius_plan.md). Mirrors
 * `modules/intent/routes.ts`: thin Fastify handlers delegating to the
 * Application-layer service, workspace-scoped via `getContext`.
 *
 *   GET  /pulls/:id/blast          → instant, computed on-demand, summary:''
 *   POST /pulls/:id/blast/explain  → one LLM call, returns { summary }
 */
export default async function blastRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new BlastService(app.container);

  app.get('/pulls/:id/blast', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.getBlast(workspaceId, req.params.id);
  });

  app.post(
    '/pulls/:id/blast/explain',
    { schema: { params: IdParams }, config: { timeout: 120_000 } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.explain(workspaceId, req.params.id, app.log);
    },
  );
}
