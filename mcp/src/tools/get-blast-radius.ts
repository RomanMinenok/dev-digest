import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GetBlastRadiusInput } from '../schemas.js';
import { BlastRadiusOut } from '../output-schemas.js';

/** STUB — no endpoint exists server-side. Always returns not_implemented; never throws, 0 HTTP calls. */
export function registerGetBlastRadiusTool(server: McpServer): void {
  server.registerTool(
    'devdigest_get_blast_radius',
    {
      title: 'Get PR blast radius (not implemented)',
      description:
        "STUB — blast radius is NOT implemented. Always returns status:'not_implemented'. " +
        'Do not rely on it; proceed without blast-radius data.',
      inputSchema: GetBlastRadiusInput.shape,
      outputSchema: BlastRadiusOut,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const result: BlastRadiusOut = {
        status: 'not_implemented',
        message: 'Blast radius is not implemented yet — proceed without it; do not rely on this tool.',
      };
      return { content: [{ type: 'text', text: result.message }], structuredContent: result };
    },
  );
}
