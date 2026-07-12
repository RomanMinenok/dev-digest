/** Domain port for the REST API this package talks to. Zod/types only. */

export interface RepoDto {
  id: string;
  owner: string;
  name: string;
  full_name: string;
}

export interface PullDto {
  id: string;
  number: number;
}

export interface AgentDto {
  id: string;
  name: string;
  description?: string | null;
  provider: string;
  model: string;
  enabled: boolean;
}

export interface StartReviewRunDto {
  run_id: string;
  agent_id: string;
  agent_name: string;
}

export interface StartReviewResultDto {
  pr_id: string;
  runs: StartReviewRunDto[];
}

export interface ReviewFindingDto {
  id: string;
  severity: string;
  category: string;
  title: string;
  file: string;
  start_line: number | null;
  end_line: number | null;
  suggestion: string | null;
  confidence: number | null;
  kind: string;
}

export interface ReviewDto {
  id: string;
  pr_id: string;
  agent_id: string | null;
  run_id: string | null;
  agent_name?: string | null;
  kind: 'summary' | 'review';
  verdict: string | null;
  summary: string | null;
  findings: ReviewFindingDto[];
}

export interface ConventionCandidateDto {
  id: string;
  rule: string;
  evidence_path: string;
  evidence_snippet: string;
  confidence: number;
  accepted: boolean;
}

export interface BlastChangedSymbolDto {
  name: string;
  file: string;
  kind: string;
}

export interface BlastCallerDto {
  name: string;
  file: string;
  line: number;
}

export interface DownstreamImpactDto {
  symbol: string;
  callers: BlastCallerDto[];
  endpoints_affected: string[];
  crons_affected: string[];
}

export interface BlastRadiusDto {
  changed_symbols: BlastChangedSymbolDto[];
  downstream: DownstreamImpactDto[];
  status: 'full' | 'partial' | 'degraded';
  summary: string;
}

/** Thrown by the http-client adapter; mapped to MCP `isError` results in tools/*.ts. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface DevDigestApiClient {
  listRepos(): Promise<RepoDto[]>;
  listPulls(repoId: string): Promise<PullDto[]>;
  getAgents(): Promise<AgentDto[]>;
  startReview(prId: string, agentId: string): Promise<StartReviewResultDto>;
  getReviews(prId: string): Promise<ReviewDto[]>;
  getConventions(repoId: string): Promise<ConventionCandidateDto[]>;
  getBlast(prId: string): Promise<BlastRadiusDto>;
}
