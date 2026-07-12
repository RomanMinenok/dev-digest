import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RunAgentOnPrInput } from '../schemas.js';
import { RunResultOut } from '../output-schemas.js';
import type { RunAgentService } from '../services/run-agent.service.js';
import { toErrorResult } from './tool-error.js';

export function registerRunAgentOnPrTool(server: McpServer, service: RunAgentService): void {
  server.registerTool(
    'run_agent_on_pr',
    {
      title: 'Run reviewer agent on a PR',
      description:
        "Starts a review of a PR by one agent (agent_id from list_agents — don't invent it). " +
        "Runs in background; waits up to ~2 min then returns findings if done, else {status:'running', run_id}. " +
        'Then call get_findings. NOT read-only: creates a review run.',
      inputSchema: RunAgentOnPrInput.shape,
      outputSchema: RunResultOut,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (input) => {
      try {
        const result = await service.run(input);
        const text =
          result.status === 'completed'
            ? `Review completed. ${result.findings_summary}. Verdict: ${result.verdict ?? 'n/a'}.`
            : `Still running (run_id=${result.run_id}). Poll again in ~${result.poll_after_seconds}s via get_findings.`;
        return { content: [{ type: 'text', text }], structuredContent: result };
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
