import type { Intent, IssueMeta, PrBrief, ReviewRecord } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { BadRequestError, NotFoundError } from '../../platform/errors.js';
import type { PinoLike } from '../../platform/run-logger.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { PullsService, assembleSmartDiff } from '../pulls/service.js';
import { BlastService } from '../blast/service.js';
import { resolveAttachedDocPaths, reviewToDto } from '../reviews/helpers.js';
import { BriefRepository } from './repository.js';
import { buildBriefInput } from './input-builder.js';
import { BriefResult, SYSTEM_PROMPT } from './brief-prompt.js';
import { validateBriefOutput } from './validate.js';

/** Empty placeholder used when a PR has no stored/computed intent yet — see
 *  `compute`'s degrade-gracefully comment for why this is a legitimate scope
 *  call rather than failing the whole brief. */
const EMPTY_INTENT: Intent = { intent: '', in_scope: [], out_of_scope: [] };

/**
 * Application layer for the PR Brief (SPEC-02-pr-brief, T8). Orchestrates
 * intent + blast + Smart Diff + linked issue + latest session reviews +
 * attached docs into a single structured LLM call, persisted via
 * `BriefRepository`. Mirrors `IntentService`/`BlastService`'s shape: no
 * Fastify import, no direct query-building outside `BriefRepository`.
 */
export class BriefService {
  private repo: BriefRepository;

  constructor(private container: Container) {
    this.repo = new BriefRepository(container.db);
  }

  /**
   * Cached-forever-until-manual-recompute (mirrors `IntentService.getOrCompute`,
   * `server/INSIGHTS.md`): a row's `head_sha` is NEVER checked here. If a row
   * exists, return it as-is; only `recompute` refreshes it. If no row exists
   * AND there's no completed review session yet, return `null` without ever
   * calling the LLM.
   */
  async getOrCompute(workspaceId: string, prId: string, logger?: PinoLike): Promise<PrBrief | null> {
    const existing = await this.repo.get(prId);
    // `pr_brief.json` is an untyped `jsonb` column (`db/schema/reviews.ts:66`
    // has no `$type<PrBrief>()`) — cast at the read boundary, matching the
    // shape we ourselves persisted in `upsert`.
    if (existing) return existing.json as PrBrief;

    const sessionReviews = await this.repo.latestSessionReviews(prId);
    if (sessionReviews.length === 0) return null;

    return this.compute(workspaceId, prId, logger);
  }

  /**
   * Always recomputes and overwrites the stored row. Throws `BadRequestError`
   * when there's no completed review session yet — an existing row (if any)
   * is left untouched.
   */
  async recompute(workspaceId: string, prId: string, logger?: PinoLike): Promise<PrBrief> {
    const sessionReviews = await this.repo.latestSessionReviews(prId);
    if (sessionReviews.length === 0) {
      throw new BadRequestError('No completed review session for this PR yet');
    }

    return this.compute(workspaceId, prId, logger);
  }

  private async compute(workspaceId: string, prId: string, logger?: PinoLike): Promise<PrBrief> {
    const found = await this.repo.getPullAndRepo(workspaceId, prId);
    if (!found) throw new NotFoundError('Pull request not found');
    const { pull, repo } = found;

    // Intent: degrade to an empty placeholder rather than failing the whole
    // compute when there's no stored intent row yet for this PR — intent
    // classification is a separate, lazily-computed feature (IntentService)
    // and this brief should still produce a useful result without it.
    const intentRow = await this.container.intentRepo.get(prId);
    const intent: Intent = intentRow
      ? { intent: intentRow.intent, in_scope: intentRow.inScope, out_of_scope: intentRow.outOfScope }
      : EMPTY_INTENT;

    const blast = await new BlastService(this.container).getBlast(workspaceId, prId);
    const smartDiff = await new PullsService(this.container).smartDiff(workspaceId, prId);
    const changedPaths = smartDiff.groups.flatMap((g) => g.files.map((f) => f.path));

    let linkedIssue: IssueMeta | null = null;
    try {
      const gh = await this.container.github();
      const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, pull.number);
      linkedIssue = detail.linked_issue ?? null;
    } catch (err) {
      logger?.warn({ err }, 'brief: GitHub detail unavailable, no linked issue');
    }

    const sessionReviewRows = await this.repo.latestSessionReviews(prId);
    // `reviewToDto` returns the `ReviewDto` shape (a wider `verdict: string |
    // null`, used elsewhere for Smart Diff assembly) — the persisted values
    // always satisfy the narrower `Verdict` enum, so this cast is safe.
    const latestSessionReviews = sessionReviewRows.map(
      (r) => reviewToDto(r.review, r.findings, null) as unknown as ReviewRecord,
    );

    const sessionAgents = await this.repo.sessionAgents(prId);
    const attachedPaths: string[] = [];
    const seenPaths = new Set<string>();
    for (const { agent, skills } of sessionAgents) {
      const linkedSkills = skills.map((s) => ({
        skill: { enabled: s.enabled, contextDocs: s.contextDocs },
      }));
      for (const p of resolveAttachedDocPaths(agent.contextDocs, linkedSkills)) {
        if (!seenPaths.has(p)) {
          seenPaths.add(p);
          attachedPaths.push(p);
        }
      }
    }
    const attachedDocs: { path: string; content: string }[] = [];
    for (const path of attachedPaths) {
      try {
        const content = await this.container.git.readFile({ owner: repo.owner, name: repo.name }, path);
        attachedDocs.push({ path, content });
      } catch (err) {
        logger?.warn({ err, path }, 'brief: attached doc unreadable, skipping');
      }
    }

    const input = buildBriefInput({
      intent,
      blast,
      smartDiff,
      linkedIssue,
      latestSessionReviews,
      attachedDocs,
    });

    const { provider, model } = await resolveFeatureModel(this.container, workspaceId, 'risk_brief');

    const llm = await this.container.llm(provider);
    const res = await llm.completeStructured({
      model,
      schema: BriefResult,
      schemaName: 'brief',
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(input) },
      ],
    });

    const costUsd = res.costUsd ?? this.container.priceBook.estimate(model, res.tokensIn, res.tokensOut);
    const { risks, review_focus } = validateBriefOutput(res.data, changedPaths);

    // No cheap source for prior-PR history yet (SPEC-02 leaves this for a
    // later task) — persist an empty list rather than fabricating entries.
    const brief: PrBrief = {
      intent,
      blast,
      risks: { risks },
      history: { history: [] },
      what: res.data.what,
      why: res.data.why,
      risk_level: res.data.risk_level,
      review_focus,
      tokens_in: res.tokensIn,
      tokens_out: res.tokensOut,
      cost_usd: costUsd,
    };

    await this.repo.upsert(prId, { json: brief, model, headSha: pull.headSha });

    return brief;
  }
}
