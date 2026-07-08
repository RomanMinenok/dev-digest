import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { IntentService } from './service.js';

/**
 * Intent Layer routes (docs/plan/intent_layer_plan.md Phase 5). Mirrors
 * `modules/conventions/routes.ts`: thin Fastify handlers delegating to the
 * Application-layer service, workspace-scoped via `getContext`.
 *
 *   GET  /pulls/:id/intent            → compute only if empty, else return cached (200, PrIntent | null)
 *   POST /pulls/:id/intent/recompute  → always recompute (empty body)
 */
export default async function intentRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new IntentService(app.container);

  app.get(
    '/pulls/:id/intent',
    { schema: { params: IdParams }, config: { timeout: 120_000 } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.getOrCompute(workspaceId, req.params.id, app.log);
    },
  );

  app.post(
    '/pulls/:id/intent/recompute',
    { schema: { params: IdParams }, config: { timeout: 120_000 } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.recompute(workspaceId, req.params.id, app.log);
    },
  );
}
