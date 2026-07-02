import type { ConventionCandidate, ConventionScanResult } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError, BadRequestError } from '../../platform/errors.js';
import { RepoRepository } from '../repos/repository.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { extractConventions } from './extractor.js';
import { ConventionsRepository } from './repository.js';
import { toConventionDto, fallbackWalk } from './helpers.js';

export class ConventionsService {
  private repo: ConventionsRepository;
  private reposRepo: RepoRepository;

  constructor(private container: Container) {
    this.repo = new ConventionsRepository(container.db);
    this.reposRepo = new RepoRepository(container.db);
  }

  async list(workspaceId: string, repoId: string): Promise<ConventionCandidate[]> {
    const repoRow = await this.reposRepo.getById(workspaceId, repoId);
    if (!repoRow) throw new NotFoundError('Repo not found');
    const rows = await this.repo.listForRepo(workspaceId, repoId);
    return rows.map(toConventionDto);
  }

  async rescan(workspaceId: string, repoId: string): Promise<ConventionScanResult> {
    const repoRow = await this.reposRepo.getById(workspaceId, repoId);
    if (!repoRow) throw new NotFoundError('Repo not found');
    if (!repoRow.clonePath) {
      throw new BadRequestError('Repo not cloned yet — index it first');
    }

    let samplePaths = await this.container.repoIntel.getConventionSamples(repoId, 12);
    if (samplePaths.length === 0) {
      samplePaths = await fallbackWalk(repoRow.clonePath, 12);
    }

    const { provider, model } = await resolveFeatureModel(this.container, workspaceId, 'conventions');
    const llm = await this.container.llm(provider);

    const drafts = await extractConventions({
      repoName: repoRow.fullName,
      clonePath: repoRow.clonePath,
      samplePaths,
      llm,
      model,
    });

    const rows = await this.repo.replaceAll(workspaceId, repoId, drafts);

    return {
      repo_id: repoId,
      repo_name: repoRow.fullName,
      sample_count: samplePaths.length,
      scanned_at: new Date().toISOString(),
      candidates: rows.map(toConventionDto),
    };
  }
}
