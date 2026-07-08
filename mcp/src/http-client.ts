import type {
  AgentDto,
  ConventionCandidateDto,
  DevDigestApiClient,
  PullDto,
  RepoDto,
  ReviewDto,
  StartReviewResultDto,
} from './ports.js';
import { ApiError } from './ports.js';
import type { Logger } from './logger.js';

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export class HttpClient implements DevDigestApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
    private readonly logger: Logger,
  ) {}

  async listRepos(): Promise<RepoDto[]> {
    return this.get<RepoDto[]>('/repos');
  }

  async listPulls(repoId: string): Promise<PullDto[]> {
    return this.get<PullDto[]>(`/repos/${encodeURIComponent(repoId)}/pulls`);
  }

  async getAgents(): Promise<AgentDto[]> {
    const raw = await this.get<Array<{ id: string; name: string; description?: string | null; provider: string; model: string; enabled: boolean }>>(
      '/agents',
    );
    return raw.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description ?? null,
      provider: a.provider,
      model: a.model,
      enabled: a.enabled,
    }));
  }

  async startReview(prId: string, agentId: string): Promise<StartReviewResultDto> {
    return this.post<StartReviewResultDto>(`/pulls/${encodeURIComponent(prId)}/review`, { agentId });
  }

  async getReviews(prId: string): Promise<ReviewDto[]> {
    return this.get<ReviewDto[]>(`/pulls/${encodeURIComponent(prId)}/reviews`);
  }

  async getConventions(repoId: string): Promise<ConventionCandidateDto[]> {
    return this.get<ConventionCandidateDto[]>(`/repos/${encodeURIComponent(repoId)}/conventions`);
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError(0, 'timeout', `Request to ${path} timed out after ${this.timeoutMs}ms`);
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new ApiError(0, 'network_error', `Could not reach DevDigest API at ${this.baseUrl}: ${message}`);
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 429) {
      throw new ApiError(429, 'rate_limited', 'DevDigest API rate limit hit — wait and retry.');
    }

    if (!res.ok) {
      let envelope: ErrorEnvelope = {};
      try {
        envelope = (await res.json()) as ErrorEnvelope;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(
        res.status,
        envelope.error?.code ?? 'http_error',
        envelope.error?.message ?? `Request to ${path} failed with status ${res.status}`,
      );
    }

    this.logger.info('http request ok', { method, path, status: res.status });
    return (await res.json()) as T;
  }
}
