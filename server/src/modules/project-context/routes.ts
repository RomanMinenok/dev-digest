import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { RepoRef } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { getContext } from '../_shared/context.js';
import { NotFoundError } from '../../platform/errors.js';
import { estimateTokens } from './helpers.js';

/**
 * project-context routes (T8, SPEC-01). Thin Fastify handlers — all
 * discovery/counting logic lives in `service.ts`/`helpers.ts` (T7); this file
 * only resolves HTTP concerns: params/query validation, `repoId` → `RepoRef`
 * resolution via `container.reposRepo`, and shaping the two responses.
 *
 *   GET /repos/:repoId/context-docs           → discovery list + scan-summary footer
 *   GET /repos/:repoId/context-docs/preview   → single doc content + token count (AC-9)
 */

const RepoIdParams = z.object({ repoId: z.string().uuid() });

/**
 * Preview query validation (AC-9). Looser than the original `.md`-only gate so
 * agent/skill context docs can include README.txt, AGENTS.yaml, etc. Path
 * escape refusal lives in `GitClient.readFile` (T5) — keep this check cheap
 * (reject absolute paths only).
 */
const ContextDocsPreviewQuery = z.object({
  path: z
    .string()
    .min(1)
    .refine((p) => !p.startsWith('/') && !p.includes('\\'), {
      message: 'path must be a repo-relative path (no absolute paths)',
    }),
});

/** Resolve `repoId` (workspace-scoped) to the `RepoRef` the `GitClient`/service need. */
async function resolveRepoRef(
  container: Container,
  workspaceId: string,
  repoId: string,
): Promise<RepoRef> {
  const row = await container.reposRepo.getById(workspaceId, repoId);
  if (!row) throw new NotFoundError('Repo not found');
  return { owner: row.owner, name: row.name };
}

export default async function projectContextRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/repos/:repoId/context-docs',
    { schema: { params: RepoIdParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const ref = await resolveRepoRef(app.container, workspaceId, req.params.repoId);
      const service = app.container.projectContextService;

      // AC-4's `used_by_count` (agents-only, from `discover()`) and AC-4a's
      // scan-summary footer total (agents-OR-skills, from `attachedPaths()`)
      // are two DIFFERENT counting rules over the same discovery list —
      // computed independently here, never conflated.
      const [docs, attachedPaths] = await Promise.all([
        service.discover(workspaceId, ref),
        service.attachedPaths(workspaceId),
      ]);

      const totalTokens = docs.reduce(
        (sum, doc) => (attachedPaths.has(doc.path) ? sum + estimateTokens(doc.size_bytes) : sum),
        0,
      );

      return {
        docs,
        summary: {
          total_count: docs.length,
          total_tokens: totalTokens,
        },
      };
    },
  );

  app.get(
    '/repos/:repoId/context-docs/preview',
    { schema: { params: RepoIdParams, querystring: ContextDocsPreviewQuery } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const ref = await resolveRepoRef(app.container, workspaceId, req.params.repoId);
      return app.container.projectContextService.preview(ref, req.query.path);
    },
  );
}
