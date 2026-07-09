import type { BlastRadius } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';
import type { PinoLike as Logger } from '../../platform/run-logger.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { BlastRepository } from './repository.js';
import { assembleBlast } from './helpers.js';
import { buildBlastSummaryInput, BlastSummary, SYSTEM_PROMPT } from './summary-prompt.js';

/**
 * Application layer for Blast Radius (docs/plan/blast_radius_plan.md). Thin
 * reader over the already-implemented `RepoIntel` facade — mirrors
 * `modules/intent/service.ts`. No Fastify import, no direct query-building.
 */
export class BlastService {
  private repo: BlastRepository;

  constructor(private container: Container) {
    this.repo = new BlastRepository(container.db);
  }

  /** Computed on-demand each call — no caching, no persistence. `summary` is always `''`. */
  async getBlast(workspaceId: string, prId: string): Promise<BlastRadius> {
    const { pull } = await this.loadPullAndRepo(workspaceId, prId);
    const changedFiles = await this.repo.listChangedFiles(prId);

    const [result, index] = await Promise.all([
      this.container.repoIntel.getBlastRadius(pull.repoId, changedFiles),
      this.container.repoIntel.getIndexState(pull.repoId),
    ]);

    return assembleBlast(result, index);
  }

  /** Recomputes the blast (not cached) and asks the LLM for a 1-3 sentence summary. */
  async explain(workspaceId: string, prId: string, logger?: Logger): Promise<{ summary: string }> {
    const blast = await this.getBlast(workspaceId, prId);

    const { provider, model } = await resolveFeatureModel(this.container, workspaceId, 'blast');

    let llm;
    try {
      llm = await this.container.llm(provider);
    } catch (err) {
      logger?.warn({ err }, 'blast: LLM provider unavailable, skipping explain');
      return { summary: '' };
    }

    try {
      const res = await llm.completeStructured({
        model,
        schema: BlastSummary,
        schemaName: 'blast_summary',
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildBlastSummaryInput(blast) },
        ],
      });
      return { summary: res.data.summary };
    } catch (err) {
      logger?.warn({ err }, 'blast: explain LLM call failed');
      return { summary: '' };
    }
  }

  private async loadPullAndRepo(workspaceId: string, prId: string) {
    const found = await this.repo.getPullAndRepo(workspaceId, prId);
    if (!found) throw new NotFoundError('Pull request not found');
    return found;
  }
}
