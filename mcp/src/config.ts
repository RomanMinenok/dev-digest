import { z } from 'zod';

export interface McpConfig {
  apiBaseUrl: string;
  requestTimeoutMs: number;
  runPollBudgetMs: number;
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

const EnvSchema = z.object({
  DEVDIGEST_API_URL: z.string().trim().min(1).optional(),
  MCP_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  RUN_POLL_BUDGET_MS: z.coerce.number().int().positive().optional(),
});

export function loadConfig(): McpConfig {
  const env = EnvSchema.parse({
    DEVDIGEST_API_URL: process.env.DEVDIGEST_API_URL,
    MCP_REQUEST_TIMEOUT_MS: process.env.MCP_REQUEST_TIMEOUT_MS,
    RUN_POLL_BUDGET_MS: process.env.RUN_POLL_BUDGET_MS,
  });

  return {
    apiBaseUrl: trimTrailingSlash(env.DEVDIGEST_API_URL ?? 'http://localhost:3001'),
    requestTimeoutMs: env.MCP_REQUEST_TIMEOUT_MS ?? 4000,
    runPollBudgetMs: env.RUN_POLL_BUDGET_MS ?? 120000,
  };
}
