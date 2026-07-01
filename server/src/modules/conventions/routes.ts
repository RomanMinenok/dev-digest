import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getContext } from '../_shared/context.js';
import { ConventionsService } from './service.js';

const RepoParams = z.object({ repoId: z.string().uuid() });

export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ConventionsService(app.container);

  app.get('/repos/:repoId/conventions', { schema: { params: RepoParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId, req.params.repoId);
  });

  app.post(
    '/repos/:repoId/conventions/rescan',
    { schema: { params: RepoParams }, config: { timeout: 120_000 } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.rescan(workspaceId, req.params.repoId);
    },
  );
}
