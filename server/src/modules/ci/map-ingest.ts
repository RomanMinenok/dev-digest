import type { CiResultArtifact, RunTrace } from '@devdigest/shared';
import type { MappedCiIngestInput } from './repository.js';

export type MapIngestAgent = {
  id: string;
  workspaceId: string;
  provider: string;
  model: string;
};

export type MapIngestInstallation = {
  id: string;
  agentId: string;
  targetType: string;
};

/**
 * Map a parsed CI artifact (or its absence) + agent defaults into the flat
 * insert shape consumed by `CiRepository.ingestRun` — application-layer
 * field resolution, not repository work.
 */
export function mapCiIngestInput(args: {
  installation: MapIngestInstallation;
  agent: MapIngestAgent;
  githubUrl: string;
  ranAt: Date;
  status: string;
  prNumber?: number | null;
  artifact: CiResultArtifact | null;
}): MappedCiIngestInput {
  const { installation, agent, artifact } = args;

  let agentRun: MappedCiIngestInput['agentRun'] = null;
  if (artifact) {
    const trace: RunTrace | null = artifact.trace ?? null;
    const stats = trace?.stats;
    agentRun = {
      provider: artifact.trace?.config.provider ?? agent.provider,
      model: artifact.trace?.config.model ?? agent.model,
      durationMs: artifact.duration_ms ?? stats?.duration_ms ?? null,
      tokensIn: stats?.tokens_in ?? null,
      tokensOut: stats?.tokens_out ?? null,
      findingsCount: artifact.findings_count,
      grounding: stats?.grounding ?? null,
      costUsd: artifact.cost_usd ?? stats?.cost_usd ?? null,
      prTitle: artifact.pr_title ?? null,
      critical: artifact.critical ?? null,
      warning: artifact.warning ?? null,
      suggestion: artifact.suggestion ?? null,
      trace,
    };
  }

  return {
    ciInstallationId: installation.id,
    agentId: installation.agentId,
    workspaceId: agent.workspaceId,
    githubUrl: args.githubUrl,
    ranAt: args.ranAt,
    prNumber: args.prNumber ?? artifact?.pr_number ?? null,
    status: args.status,
    source: installation.targetType,
    agentRun,
  };
}
