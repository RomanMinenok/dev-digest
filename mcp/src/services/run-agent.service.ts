import type { DevDigestApiClient, ReviewDto } from '../ports.js';
import type { Resolver } from '../resolver.js';
import type { RunResultOut } from '../output-schemas.js';
import { severityCounts, toFindingOut } from './findings.service.js';

const POLL_INTERVAL_MS = 1500;

export interface RunAgentInput {
  repo: string;
  pr_number: number;
  agent_id: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Use case: start a review + poll for its result, correlated by run_id.
 * `GET /pulls/:id/reviews` returns ALL reviews for the PR (server/INSIGHTS.md,
 * reviews/service.ts:131 fire-and-forget) — filtering by run_id is mandatory,
 * otherwise stale/other-agent reviews would be returned.
 */
export class RunAgentService {
  constructor(
    private readonly client: DevDigestApiClient,
    private readonly resolver: Resolver,
    private readonly pollBudgetMs: number,
  ) {}

  async run(input: RunAgentInput): Promise<RunResultOut> {
    const prId = await this.resolver.resolvePrId(input.repo, input.pr_number);
    const started = await this.client.startReview(prId, input.agent_id);
    const run = started.runs[0];
    if (!run) {
      throw new Error(`No run was started for agent '${input.agent_id}' on PR #${input.pr_number}`);
    }

    const deadline = Date.now() + this.pollBudgetMs;
    while (Date.now() < deadline) {
      const reviews = await this.client.getReviews(prId);
      const match = reviews.find((r) => r.run_id === run.run_id && r.kind === 'review');
      if (match) {
        return this.completed(run.run_id, match);
      }
      await sleep(Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
    }

    return { status: 'running', run_id: run.run_id, poll_after_seconds: 30 };
  }

  private completed(runId: string, review: ReviewDto): RunResultOut {
    const findings = review.findings.map(toFindingOut);
    const counts = severityCounts(findings);
    return {
      status: 'completed',
      run_id: runId,
      verdict: review.verdict,
      summary: review.summary,
      findings_summary: `${findings.length} findings: ${counts}`,
      findings,
    };
  }
}
