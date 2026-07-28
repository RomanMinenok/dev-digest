import type { RunTrace } from '@devdigest/shared';
import type { Db } from '../db/client.js';
import * as t from '../db/schema.js';
import type { CiRunRow, MappedCiIngestInput, PersistCiIngestRun } from '../modules/ci/repository.js';
import {
  createCiAgentRun,
  saveRunTrace,
} from '../modules/reviews/repository/run.repo.js';

/**
 * Composition-root factory: one atomic transaction for CI ingest writes.
 * Lives here (not under `modules/ci/`) so the `ci → reviews` import edge
 * stays confined to the composition root.
 */
export function createPersistCiIngestRun(db: Db): PersistCiIngestRun {
  return async function persistCiIngestRun(input: MappedCiIngestInput): Promise<CiRunRow> {
    return db.transaction(async (tx) => {
      let runId: string | null = null;

      if (input.agentRun) {
        const { trace, ...runValues } = input.agentRun;
        runId = await createCiAgentRun(tx, {
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          provider: runValues.provider,
          model: runValues.model,
          durationMs: runValues.durationMs,
          tokensIn: runValues.tokensIn,
          tokensOut: runValues.tokensOut,
          findingsCount: runValues.findingsCount,
          grounding: runValues.grounding,
          costUsd: runValues.costUsd,
          ranAt: input.ranAt,
        });

        if (trace) {
          await saveRunTrace(tx, runId, trace as RunTrace);
        }
      }

      const [ciRun] = await tx
        .insert(t.ciRuns)
        .values({
          ciInstallationId: input.ciInstallationId,
          runId,
          prNumber: input.prNumber,
          prTitle: input.agentRun?.prTitle ?? null,
          ranAt: input.ranAt,
          status: input.status,
          findingsCount: input.agentRun?.findingsCount ?? null,
          critical: input.agentRun?.critical ?? null,
          warning: input.agentRun?.warning ?? null,
          suggestion: input.agentRun?.suggestion ?? null,
          costUsd: input.agentRun?.costUsd ?? null,
          githubUrl: input.githubUrl,
          source: input.source,
        })
        .returning();

      return ciRun!;
    });
  };
}
