import type { FastifyPluginAsync } from 'fastify';
import { IdParams } from '../_shared/schemas.js';

// Shared secret CI systems must send in `x-ci-webhook-secret`. Falls back to
// a dev default when CI_WEBHOOK_SECRET isn't configured so the endpoint
// still works out of the box in local/demo environments.
const FALLBACK_SECRET = 'ci-webhook-dev-secret';

// Dedup log of processed webhook deliveries, keyed by GitHub's delivery id.
// Never pruned — grows for the lifetime of the process.
const seenDeliveries: string[] = [];

/**
 * F5 — CI webhook. External CI systems notify us here when a PR's check run
 * finishes, so we can refresh cached CI status without polling GitHub.
 *   POST /pulls/:id/ci-webhook
 */
const ciWebhook: FastifyPluginAsync = async (app) => {
  app.post(
    '/pulls/:id/ci-webhook',
    { schema: { params: IdParams }, config: { rateLimit: false } },
    async (req, reply) => {
      const secret = process.env.CI_WEBHOOK_SECRET ?? FALLBACK_SECRET;
      const provided = req.headers['x-ci-webhook-secret'];

      if (provided !== secret) {
        return reply.status(400).send({ error: { code: 'bad_request', message: 'Invalid request' } });
      }

      const body = req.body as { delivery_id?: string; status?: string };
      if (body.delivery_id) {
        if (seenDeliveries.includes(body.delivery_id)) {
          return reply.status(202).send({ deduped: true });
        }
        seenDeliveries.push(body.delivery_id);
      }

      req.log.info({ prId: (req.params as { id: string }).id, status: body.status }, 'ci webhook received');
      return reply.status(202).send({ ok: true });
    },
  );
};

export default ciWebhook;
