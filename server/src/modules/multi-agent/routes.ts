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
 *   GET /multi-agent/latest-run     → pointer to the newest run in a repo (or `null`)
 *
 * The spec caps this module at the first two reads (Non-goal: no `?runId=`,
 * no list/history endpoint) and `latest-run` stays inside that cap: it is a
 * single-row pointer (`id` + `pr_id`), not a list — the global nav entry needs
 * to know whether ANY run exists before it can choose between Configure and
 * Results, and neither of the other two reads can answer that without a PR id
 * in hand. It exposes no history: one row, newest only.
 *
 * `estimates` is deliberately NOT mounted under `/agents/...` (this module
 * owns it; `/agents/estimates` would sit ambiguously next to the agents
 * module's `/agents/:id`).
 */
const EstimatesQuery = z.object({
  // Comma-separated agent ids. Omitted → every agent in the workspace
  // (see `MultiAgentService.estimates`).
  agent_ids: z.string().optional(),
});

const LatestRunQuery = z.object({
  repo_id: z.string().uuid(),
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

  // ---- Newest run in a repo, as a pointer (AC-16) ---------------------------
  app.get(
    '/multi-agent/latest-run',
    { schema: { querystring: LatestRunQuery } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.latestForRepo(workspaceId, req.query.repo_id);
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
