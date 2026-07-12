import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GetBlastRadiusInput } from '../schemas.js';
import { BlastRadiusOut } from '../output-schemas.js';
import type { BlastService } from '../services/blast.service.js';
import { toErrorResult } from './tool-error.js';

export function registerGetBlastRadiusTool(server: McpServer, service: BlastService): void {
  server.registerTool(
    'get_blast_radius',
    {
      title: 'Get PR blast radius',
      description:
        "Returns the blast radius of a PR: changed symbols, their callers, and downstream HTTP " +
        "endpoints/cron jobs. Pass repo as 'owner/name'. status reflects the code index's health " +
        "(full/partial/degraded) — degraded means the result is best-effort.",
      inputSchema: GetBlastRadiusInput.shape,
      outputSchema: BlastRadiusOut,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ repo, pr_number }) => {
      try {
        const { out, text } = await service.get({ repo, pr_number });
        return { content: [{ type: 'text', text }], structuredContent: out };
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
