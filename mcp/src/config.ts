export interface McpConfig {
  apiBaseUrl: string;
  requestTimeoutMs: number;
  runPollBudgetMs: number;
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function loadConfig(): McpConfig {
  const apiBaseUrl = trimTrailingSlash(process.env.DEVDIGEST_API_URL?.trim() || 'http://localhost:3001');
  const requestTimeoutMs = Number(process.env.MCP_REQUEST_TIMEOUT_MS) || 4000;
  const runPollBudgetMs = Number(process.env.RUN_POLL_BUDGET_MS) || 120000;
  return { apiBaseUrl, requestTimeoutMs, runPollBudgetMs };
}
