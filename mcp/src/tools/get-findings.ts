import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GetFindingsInput } from '../schemas.js';
import { FindingsPageOut } from '../output-schemas.js';
import type { FindingsService } from '../services/findings.service.js';
import { toErrorResult } from './tool-error.js';

export function registerGetFindingsTool(server: McpServer, service: FindingsService): void {
  server.registerTool(
    'get_findings',
    {
      title: 'Get PR review findings',
      description:
        'Returns findings for an already-run review of a PR (call run_agent_on_pr first). ' +
        'Summary-first + paginated: leads with counts, then a page of ~10. ' +
        "Use response_format 'concise' (title+severity+file) or 'detailed' (adds line range, suggestion, finding_id).",
      inputSchema: GetFindingsInput.shape,
      outputSchema: FindingsPageOut,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input) => {
      try {
        const page = await service.get(input);
        const countsLine = Object.entries(page.counts_by_severity)
          .map(([sev, n]) => `${n} ${sev}`)
          .join(', ') || 'none';
        const text = `${page.total} findings: ${countsLine}. Page ${page.page} (${page.findings.length} of ${page.page_size}).`;
        return { content: [{ type: 'text', text }], structuredContent: page };
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
