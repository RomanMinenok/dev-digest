import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GetConventionsInput } from '../schemas.js';
import { ConventionsOut } from '../output-schemas.js';
import type { DevDigestApiClient } from '../ports.js';
import type { Resolver } from '../resolver.js';
import { toErrorResult } from './tool-error.js';

export function registerGetConventionsTool(server: McpServer, client: DevDigestApiClient, resolver: Resolver): void {
  server.registerTool(
    'devdigest_get_conventions',
    {
      title: 'Get repo conventions',
      description:
        "Returns coding conventions extracted for a repo (rule + evidence path + confidence). Pass repo as 'owner/name'. " +
        'Empty result means no conventions have been scanned yet.',
      inputSchema: GetConventionsInput.shape,
      outputSchema: ConventionsOut,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ repo }) => {
      try {
        const repoId = await resolver.resolveRepoId(repo);
        const candidates = await client.getConventions(repoId);
        const conventions = candidates.map((c) => ({
          rule: c.rule,
          evidence_path: c.evidence_path,
          evidence_snippet: c.evidence_snippet,
          confidence: c.confidence,
          accepted: c.accepted,
        }));
        const text =
          conventions.length === 0
            ? 'No conventions have been scanned yet for this repo.'
            : `${conventions.length} conventions: ` + conventions.map((c) => c.rule).join('; ');
        return { content: [{ type: 'text', text }], structuredContent: { conventions } };
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
