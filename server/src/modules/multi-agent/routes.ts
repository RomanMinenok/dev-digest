import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { MultiAgentService } from './service.js';

/**
 * multi-agent module (SPEC-05, T-15 — AC-14, AC-16, AC-12, AC-30).
 *   GET /pulls/:id/multi-agent-run  → the latest multi-agent run for a PR (or `null`)
 *   GET /multi-agent/estimates      → per-agent duration/cost estimates
 *
 * Exactly two read endpoints — the spec caps this module at two (Non-goal):
 * no `?runId=`, no list/history endpoint. `estimates` is deliberately NOT
 * mounted under `/agents/...` (this module owns it; `/agents/estimates` would
 * sit ambiguously next to the agents module's `/agents/:id`).
 */
const EstimatesQuery = z.object({
  // Comma-separated agent ids. Omitted → every agent in the workspace
  // (see `MultiAgentService.estimates`).
  agent_ids: z.string().optional(),
});

export default async function multiAgentRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = new MultiAgentService(container);

  // ---- Latest multi-agent run for a PR (AC-14, AC-16) ----------------------
  app.get(
    '/pulls/:id/multi-agent-run',
    { schema: { params: IdParams } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.latestForPull(workspaceId, req.params.id);
    },
  );

  // ---- Per-agent duration/cost estimates (AC-12) ----------------------------
  app.get(
    '/multi-agent/estimates',
    { schema: { querystring: EstimatesQuery } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      const agentIds = req.query.agent_ids
        ?.split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      return service.estimates(workspaceId, agentIds && agentIds.length > 0 ? agentIds : undefined);
    },
  );
}
