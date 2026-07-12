import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListAgentsInput } from '../schemas.js';
import { AgentOut } from '../output-schemas.js';
import type { DevDigestApiClient } from '../ports.js';
import { toErrorResult } from './tool-error.js';

export function registerListAgentsTool(server: McpServer, client: DevDigestApiClient): void {
  server.registerTool(
    'list_agents',
    {
      title: 'List reviewer agents',
      description:
        'Lists configured reviewer agents (agent_id, name, provider, model, enabled). ' +
        'Call this FIRST to obtain a valid agent_id — never invent one. ' +
        'Feed agent_id to run_agent_on_pr.',
      inputSchema: ListAgentsInput.shape,
      outputSchema: { agents: AgentOut.array() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const agents = await client.getAgents();
        const out = agents.map((a) => ({
          agent_id: a.id,
          name: a.name,
          description: a.description ?? null,
          provider: a.provider,
          model: a.model,
          enabled: a.enabled,
        }));
        return {
          content: [{ type: 'text', text: `${out.length} agents: ` + out.map((a) => `${a.name} (${a.agent_id})`).join(', ') }],
          structuredContent: { agents: out },
        };
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
