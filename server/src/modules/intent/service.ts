import type { PrIntent, IssueMeta, UnifiedDiff } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';
import { loadDiff, diffFromPrFiles } from '../reviews/diff-loader.js';
import { ReviewRepository } from '../reviews/repository.js';
import type { Logger } from '../reviews/run-executor.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { resolveSpecContext } from './spec-resolver.js';
import { buildIntentInput, estimateFullDiffTokens } from './input-builder.js';
import { classifyIntent } from './classifier.js';
import { IntentRepository, type PrIntentRow } from './repository.js';

/**
 * Application layer for the Intent Layer (docs/plan/intent_layer_plan.md
 * Phase 5). Orchestrates: load PR + diff, resolve model, spec-resolver →
 * input-builder → classifier → repository.upsert, and logs token savings.
 * No Fastify import, no direct query-building — PR/repo/intent-row reads and
 * writes go through `IntentRepository` — mirrors `modules/conventions/service.ts`.
 */
export class IntentService {
  private repo: IntentRepository;
  private reviewRepo: ReviewRepository;

  constructor(private container: Container) {
    this.repo = new IntentRepository(container.db);
    this.reviewRepo = new ReviewRepository(container.db);
  }

  /** Cached DTO if present AND fresh (stored head_sha === current PR head); else recomputes. */
  async getOrCompute(workspaceId: string, prId: string, logger?: Logger): Promise<PrIntent | null> {
    const { pull } = await this.loadPullAndRepo(workspaceId, prId);

    const existing = await this.repo.get(prId);
    if (existing && existing.headSha === pull.headSha) {
      return toDto(existing);
    }

    return this.compute(workspaceId, prId, logger);
  }

  /** Always recomputes and overwrites the stored row. */
  async recompute(workspaceId: string, prId: string, logger?: Logger): Promise<PrIntent | null> {
    return this.compute(workspaceId, prId, logger);
  }

  private async compute(workspaceId: string, prId: string, logger?: Logger): Promise<PrIntent | null> {
    const { pull, repo } = await this.loadPullAndRepo(workspaceId, prId);

    // Prefer a fresh GitHub fetch (title/body/head_sha + linked_issue); fall
    // back to the persisted row when GitHub is unavailable (offline / no
    // token) — same best-effort pattern as pulls/routes.ts's PR-detail GET.
    let title = pull.title;
    let body: string | null = pull.body;
    let linkedIssue: IssueMeta | null | undefined;
    try {
      const gh = await this.container.github();
      const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, pull.number);
      title = detail.title;
      body = detail.body ?? null;
      linkedIssue = detail.linked_issue;
    } catch (err) {
      logger?.warn({ err }, 'intent: GitHub detail unavailable, using persisted PR fields');
    }

    const diff = await loadDiff(this.container, this.reviewRepo, workspaceId, pull, repo).catch(() =>
      diffFromPrFiles(this.reviewRepo, pull.id),
    );

    const { provider, model } = await resolveFeatureModel(this.container, workspaceId, 'review_intent');

    // Best-effort spec context — never throws (spec-resolver's own contract).
    // diff.files (not a separate PrFile fetch) supplies the changed-.md-file
    // list; spec-resolver only reads `.path` from each entry.
    const changedFiles = diff.files.map((f) => ({
      path: f.path,
      additions: f.additions,
      deletions: f.deletions,
      patch: null,
    }));
    const specContext = await resolveSpecContext({
      repo: { owner: repo.owner, name: repo.name },
      body,
      prDetail: { linked_issue: linkedIssue ?? null, files: changedFiles },
      git: this.container.git,
    }).catch(() => ({ contextText: '', sources: [] }));

    const input = buildIntentInput({ title, body, specContext: specContext.contextText, diff });

    let llm;
    try {
      llm = await this.container.llm(provider);
    } catch (err) {
      logger?.warn({ err }, 'intent: LLM provider unavailable, skipping classification');
      return null;
    }

    const result = await classifyIntent({ input, llm, model });
    if (!result.intent) {
      logger?.warn({ prId, model }, 'intent: classifier returned no result, not persisting');
      return null;
    }

    const row = await this.repo.upsert(prId, {
      intent: result.intent.intent,
      inScope: result.intent.in_scope,
      outOfScope: result.intent.out_of_scope,
      model,
      headSha: pull.headSha,
      sources: specContext.sources,
    });

    this.logTokenSavings({ prId, model, diff, input, classifierTokensIn: result.tokensIn, logger });

    return toDto(row);
  }

  private logTokenSavings(params: {
    prId: string;
    model: string;
    diff: UnifiedDiff;
    input: string;
    classifierTokensIn: number;
    logger?: Logger;
  }): void {
    const { prId, model, diff, input, classifierTokensIn, logger } = params;
    const tokenizer = this.container.tokenizer;
    const fullDiffTokens = estimateFullDiffTokens(diff, tokenizer);
    const headerTokens = tokenizer.count(input);
    const savedTokens = Math.max(0, fullDiffTokens - headerTokens);
    const savedPct = fullDiffTokens > 0 ? Math.round((savedTokens / fullDiffTokens) * 100) : 0;

    // Counts only — never log raw PR/diff/spec content (plan §3 house rule).
    (logger ?? console).info(
      { prId, model, headerTokens, fullDiffTokens, savedTokens, savedPct, classifierTokensIn },
      'intent: computed',
    );
  }

  private async loadPullAndRepo(workspaceId: string, prId: string) {
    const found = await this.repo.getPullAndRepo(workspaceId, prId);
    if (!found) throw new NotFoundError('Pull request not found');
    return found;
  }
}

function toDto(row: PrIntentRow): PrIntent {
  return {
    pr_id: row.prId,
    intent: row.intent,
    in_scope: row.inScope,
    out_of_scope: row.outOfScope,
    model: row.model,
    head_sha: row.headSha,
    updated_at: row.updatedAt.toISOString(),
    sources: row.sources,
  };
}
