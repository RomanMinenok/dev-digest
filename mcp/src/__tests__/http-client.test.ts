import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../http-client.js';
import { ApiError } from '../ports.js';
import { createLogger } from '../logger.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('HttpClient', () => {
  const logger = createLogger();
  let client: HttpClient;

  beforeEach(() => {
    client = new HttpClient('http://localhost:3001', 4000, logger);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns parsed JSON on 2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, [{ id: 'a1' }])));
    const result = await client.listRepos();
    expect(result).toEqual([{ id: 'a1' }]);
  });

  it('maps a non-2xx error envelope to ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { error: { code: 'not_found', message: 'Repo not found' } })),
    );
    await expect(client.listRepos()).rejects.toMatchObject(
      new ApiError(404, 'not_found', 'Repo not found'),
    );
  });

  it('maps 429 to a rate_limited ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    await expect(client.listRepos()).rejects.toMatchObject({ status: 429, code: 'rate_limited' });
  });

  it('maps a network failure to an ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));
    await expect(client.listRepos()).rejects.toMatchObject({ code: 'network_error' });
  });

  it('maps an abort (timeout) to an ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        return Promise.reject(err);
      }),
    );
    await expect(client.listRepos()).rejects.toMatchObject({ code: 'timeout' });
  });
});
