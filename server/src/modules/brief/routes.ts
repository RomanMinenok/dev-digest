import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { BriefService } from './service.js';

/**
 * PR Brief routes (SPEC-02-pr-brief, T9). Mirrors `modules/intent/routes.ts`:
 * thin Fastify handlers delegating to the Application-layer service,
 * workspace-scoped via `getContext`.
 *
 *   GET  /pulls/:id/brief            → compute only if no session review yet
 *                                       computed for, else return cached (200, PrBrief | null)
 *   POST /pulls/:id/brief/recompute  → always recompute (empty body)
 */
export default async function briefRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new BriefService(app.container);

  app.get(
    '/pulls/:id/brief',
    { schema: { params: IdParams }, config: { timeout: 120_000 } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.getOrCompute(workspaceId, req.params.id, app.log);
    },
  );

  app.post(
    '/pulls/:id/brief/recompute',
    { schema: { params: IdParams }, config: { timeout: 120_000 } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.recompute(workspaceId, req.params.id, app.log);
    },
  );
}
