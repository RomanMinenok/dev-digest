import { describe, it, expect, afterEach } from 'vitest';
import { loadConfig } from '../config.js';

const ENV_KEYS = ['DEVDIGEST_API_URL', 'MCP_REQUEST_TIMEOUT_MS', 'RUN_POLL_BUDGET_MS'] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe('loadConfig', () => {
  it('applies defaults when env vars are unset', () => {
    expect(loadConfig()).toEqual({
      apiBaseUrl: 'http://localhost:3001',
      requestTimeoutMs: 4000,
      runPollBudgetMs: 120000,
    });
  });

  it('applies valid env vars, trimming a trailing slash from the URL', () => {
    process.env.DEVDIGEST_API_URL = 'https://api.example.com/';
    process.env.MCP_REQUEST_TIMEOUT_MS = '5000';
    process.env.RUN_POLL_BUDGET_MS = '60000';

    expect(loadConfig()).toEqual({
      apiBaseUrl: 'https://api.example.com',
      requestTimeoutMs: 5000,
      runPollBudgetMs: 60000,
    });
  });

  it('throws when MCP_REQUEST_TIMEOUT_MS is not a number', () => {
    process.env.MCP_REQUEST_TIMEOUT_MS = 'abc';
    expect(() => loadConfig()).toThrow();
  });

  it('throws when RUN_POLL_BUDGET_MS is not positive', () => {
    process.env.RUN_POLL_BUDGET_MS = '-1';
    expect(() => loadConfig()).toThrow();
  });

  it('throws when RUN_POLL_BUDGET_MS is zero', () => {
    process.env.RUN_POLL_BUDGET_MS = '0';
    expect(() => loadConfig()).toThrow();
  });
});
