import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import * as t from '../../db/schema.js';
import { BadRequestError } from '../../platform/errors.js';

/**
 * GitHub webhooks — auto-poll a linked repo when a `pull_request` event lands,
 * so operators don't have to hit POST /repos/:id/poll after every push.
 *
 *   POST /webhooks/github  → verify signature, sync PR list for matching repo
 *
 * Configure the webhook secret via SecretsProvider key `GITHUB_WEBHOOK_SECRET`
 * (or env of the same name). Point the GitHub App / repo webhook at this path.
 */

const PullRequestPayload = z.object({
  action: z.string(),
  repository: z.object({
    name: z.string(),
    owner: z.object({ login: z.string() }),
  }),
  pull_request: z
    .object({
      number: z.number().int(),
      title: z.string(),
      user: z.object({ login: z.string() }).optional(),
      head: z.object({
        ref: z.string(),
        sha: z.string(),
      }),
      base: z.object({ ref: z.string() }),
      additions: z.number().int().optional(),
      deletions: z.number().int().optional(),
      changed_files: z.number().int().optional(),
      state: z.string().optional(),
      updated_at: z.string().optional(),
    })
    .optional(),
});

/** Compare GitHub's `sha256=` HMAC to the one we compute. */
function signaturesMatch(expectedHex: string, provided: string): boolean {
  const want = Buffer.from(`sha256=${expectedHex}`, 'utf8');
  const got = Buffer.from(provided, 'utf8');
  if (want.length !== got.length) return false;
  return timingSafeEqual(want, got);
}

export default async function webhooksRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;

  app.post('/webhooks/github', async (req) => {
    const signature = req.headers['x-hub-signature-256'];
    const secret =
      (await container.secrets.get('GITHUB_WEBHOOK_SECRET')) ??
      process.env.GITHUB_WEBHOOK_SECRET;

    // Local/dev webhook deliveries often omit the signature header (ngrok,
    // manual curl). Only enforce HMAC when GitHub actually sent one.
    if (typeof signature === 'string' && secret) {
      // Fastify has already JSON-parsed the body; re-serialize for HMAC so we
      // don't need a raw-body plugin. Key order is stable enough for our payloads.
      const raw = JSON.stringify(req.body ?? {});
      const digest = createHmac('sha256', secret).update(raw).digest('hex');
      if (!signaturesMatch(digest, signature)) {
        throw new BadRequestError('Invalid webhook signature');
      }
    }

    const parsed = PullRequestPayload.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Unrecognized webhook payload');
    }

    const event = req.headers['x-github-event'];
    if (event !== 'pull_request' || !parsed.data.pull_request) {
      return { ok: true, ignored: true };
    }

    const owner = parsed.data.repository.owner.login;
    const name = parsed.data.repository.name;
    const pr = parsed.data.pull_request;

    const [repo] = await container.db
      .select()
      .from(t.repos)
      .where(and(eq(t.repos.owner, owner), eq(t.repos.name, name)))
      .limit(1);

    if (!repo) {
      return { ok: true, synced: 0, reason: 'repo_not_linked' };
    }

    await container.db
      .insert(t.pullRequests)
      .values({
        workspaceId: repo.workspaceId,
        repoId: repo.id,
        number: pr.number,
        title: pr.title,
        author: pr.user?.login ?? 'unknown',
        branch: pr.head.ref,
        base: pr.base.ref,
        headSha: pr.head.sha,
        additions: pr.additions ?? 0,
        deletions: pr.deletions ?? 0,
        filesCount: pr.changed_files ?? 0,
        status: pr.state === 'closed' ? 'closed' : 'open',
        updatedAt: pr.updated_at ? new Date(pr.updated_at) : null,
      })
      .onConflictDoUpdate({
        target: [t.pullRequests.repoId, t.pullRequests.number],
        set: {
          title: pr.title,
          headSha: pr.head.sha,
          additions: pr.additions ?? 0,
          deletions: pr.deletions ?? 0,
          filesCount: pr.changed_files ?? 0,
          status: pr.state === 'closed' ? 'closed' : 'open',
          updatedAt: pr.updated_at ? new Date(pr.updated_at) : null,
        },
      });

    await container.db
      .update(t.repos)
      .set({ lastPolledAt: new Date() })
      .where(eq(t.repos.id, repo.id));

    return { ok: true, synced: 1, reviewTriggered: false };
  });
}
