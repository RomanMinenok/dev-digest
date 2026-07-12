import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerListAgentsTool } from '../tools/list-agents.js';
import { registerGetConventionsTool } from '../tools/get-conventions.js';
import { registerGetBlastRadiusTool } from '../tools/get-blast-radius.js';
import { BlastService } from '../services/blast.service.js';
import { Resolver } from '../resolver.js';
import type { DevDigestApiClient } from '../ports.js';

async function connectedClient(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

function fakeClient(overrides: Partial<DevDigestApiClient> = {}): DevDigestApiClient {
  return {
    listRepos: async () => [{ id: 'r1', owner: 'acme', name: 'widgets', full_name: 'acme/widgets' }],
    listPulls: async () => [],
    getAgents: async () => [],
    startReview: async () => ({ pr_id: '', runs: [] }),
    getReviews: async () => [],
    getConventions: async () => [],
    getBlast: async () => ({ changed_symbols: [], downstream: [], status: 'full', summary: '' }),
    ...overrides,
  };
}

describe('list_agents tool', () => {
  it('returns content and structuredContent shaped as AgentOut[]', async () => {
    const client = fakeClient({
      getAgents: async () => [
        { id: 'a1', name: 'Security Reviewer', description: 'finds bugs', provider: 'anthropic', model: 'claude', enabled: true },
      ],
    });
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerListAgentsTool(server, client);
    const mcpClient = await connectedClient(server);

    const result = await mcpClient.callTool({ name: 'list_agents', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      agents: [{ agent_id: 'a1', name: 'Security Reviewer', description: 'finds bugs', provider: 'anthropic', model: 'claude', enabled: true }],
    });
    expect(result.content).toEqual([{ type: 'text', text: '1 agents: Security Reviewer (a1)' }]);
  });
});

describe('get_conventions tool', () => {
  it('returns an empty-conventions message without error when repo has none scanned', async () => {
    const client = fakeClient({ getConventions: async () => [] });
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerGetConventionsTool(server, client, new Resolver(client));
    const mcpClient = await connectedClient(server);

    const result = await mcpClient.callTool({ name: 'get_conventions', arguments: { repo: 'acme/widgets' } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ conventions: [] });
    expect(result.content).toEqual([{ type: 'text', text: 'No conventions have been scanned yet for this repo.' }]);
  });

  it('maps an unknown repo to isError:true', async () => {
    const client = fakeClient({ listRepos: async () => [] });
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerGetConventionsTool(server, client, new Resolver(client));
    const mcpClient = await connectedClient(server);

    const result = await mcpClient.callTool({ name: 'get_conventions', arguments: { repo: 'nope/nope' } });
    expect(result.isError).toBe(true);
  });
});

describe('get_blast_radius tool', () => {
  it('returns structured blast data for a known repo/PR', async () => {
    const client = fakeClient({
      listPulls: async () => [{ id: 'pr-1', number: 1 }],
      getBlast: async () => ({
        changed_symbols: [{ name: 'foo', file: 'src/foo.ts', kind: 'function' }],
        downstream: [
          {
            symbol: 'foo',
            callers: [{ name: 'bar', file: 'src/bar.ts', line: 12 }],
            endpoints_affected: ['GET /foo'],
            crons_affected: [],
          },
        ],
        status: 'full',
        summary: '',
      }),
    });
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerGetBlastRadiusTool(server, new BlastService(client, new Resolver(client)));
    const mcpClient = await connectedClient(server);

    const result = await mcpClient.callTool({
      name: 'get_blast_radius',
      arguments: { repo: 'acme/widgets', pr_number: 1 },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      status: 'full',
      changed_symbols: [{ name: 'foo', file: 'src/foo.ts', kind: 'function' }],
      downstream: [
        {
          symbol: 'foo',
          callers: [{ name: 'bar', file: 'src/bar.ts', line: 12 }],
          endpoints: ['GET /foo'],
          crons: [],
        },
      ],
      summary: '',
    });
  });

  it('maps an unknown repo to isError:true', async () => {
    const client = fakeClient({ listRepos: async () => [] });
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerGetBlastRadiusTool(server, new BlastService(client, new Resolver(client)));
    const mcpClient = await connectedClient(server);

    const result = await mcpClient.callTool({
      name: 'get_blast_radius',
      arguments: { repo: 'nope/nope', pr_number: 1 },
    });
    expect(result.isError).toBe(true);
  });
});
