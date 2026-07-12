import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { HttpClient } from './http-client.js';
import { Resolver } from './resolver.js';
import { RunAgentService } from './services/run-agent.service.js';
import { FindingsService } from './services/findings.service.js';
import { BlastService } from './services/blast.service.js';
import { registerListAgentsTool } from './tools/list-agents.js';
import { registerRunAgentOnPrTool } from './tools/run-agent-on-pr.js';
import { registerGetFindingsTool } from './tools/get-findings.js';
import { registerGetConventionsTool } from './tools/get-conventions.js';
import { registerGetBlastRadiusTool } from './tools/get-blast-radius.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger();
  const client = new HttpClient(config.apiBaseUrl, config.requestTimeoutMs, logger);
  const resolver = new Resolver(client);
  const runAgentService = new RunAgentService(client, resolver, config.runPollBudgetMs);
  const findingsService = new FindingsService(client, resolver);
  const blastService = new BlastService(client, resolver);

  const server = new McpServer({ name: 'devdigest-mcp', version: '0.0.0' });

  registerListAgentsTool(server, client);
  registerRunAgentOnPrTool(server, runAgentService);
  registerGetFindingsTool(server, findingsService);
  registerGetConventionsTool(server, client, resolver);
  registerGetBlastRadiusTool(server, blastService);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('devdigest-mcp connected over stdio', { apiBaseUrl: config.apiBaseUrl });
}

main().catch((err) => {
  console.error('[fatal] devdigest-mcp failed to start', err);
  process.exit(1);
});
