import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CiExportInput, CiRunStatus } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';

/** Body for non-mutating export preview — same as export minus `action`. */
const CiPreviewBody = CiExportInput.omit({ action: true });

/**
 * `days` query validation for the CI Runs list (AC-38). Absent `days` defaults
 * to 7 (client filter default); values outside 7 / 30 / 90 are rejected at the
 * route boundary with 422 before the handler runs.
 */
const CiRunsQuery = z.object({
  repo: z.string().min(1).optional(),
  days: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(7), z.literal(30), z.literal(90)]))
    .default(7),
  agent_id: z.string().uuid().optional(),
  status: CiRunStatus.optional(),
  source: z.string().min(1).optional(),
});

/**
 * CI module routes (SPEC-05, T20).
 *
 *   POST /agents/:id/export-ci/preview  → CiPreview (non-mutating)
 *   POST /agents/:id/export-ci          → CiExport JSON or application/zip
 *   GET  /ci-runs                       → CiRun[] (ingest + list)
 *   GET  /agents/:id/ci-installations   → CiInstallation[] + derived status
 *
 * Trace for a CI run: reuse GET /runs/:id/trace — no dedicated CI trace route.
 */
export default async function ciRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();

  app.post(
    '/agents/:id/export-ci/preview',
    { schema: { params: IdParams, body: CiPreviewBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return app.container.ciService.preview(workspaceId, req.params.id, req.body);
    },
  );

  app.post(
    '/agents/:id/export-ci',
    { schema: { params: IdParams, body: CiExportInput }, config: { timeout: 120_000 } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const result = await app.container.ciService.export(workspaceId, req.params.id, req.body);

      if (req.body.action === 'files') {
        if (!('zip' in result)) {
          throw new Error('Expected zip result for action "files"');
        }
        return reply
          .header('Content-Type', 'application/zip')
          .header('Content-Disposition', 'attachment; filename="devdigest-ci.zip"')
          .send(result.zip);
      }

      return result;
    },
  );

  app.get('/ci-runs', { schema: { querystring: CiRunsQuery } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const { agent_id, ...rest } = req.query;
    return app.container.ciService.listRuns(workspaceId, {
      ...rest,
      agentId: agent_id,
    });
  });

  app.get(
    '/agents/:id/ci-installations',
    { schema: { params: IdParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return app.container.ciService.listInstallations(workspaceId, req.params.id);
    },
  );
}
