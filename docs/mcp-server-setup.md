# `@devdigest/mcp` — Set up from scratch, test, manage auto-connection

Guide for a local MCP server (`mcp/`) that provides Claude Code (or any other
MCP client) with 5 `devdigest_*` tools via stdio, translating them into REST calls
to an already-running `@devdigest/api` (`:3001`). Architecture details and contracts are in
`docs/plan/mcp-server-plan.md` and `mcp/README.md`.

## 1. Prerequisite — `@devdigest/api` must be running

```bash
./scripts/dev.sh --db-only    # minimum: Postgres + migrations + seed
# in another terminal:
cd server && pnpm dev          # API on :3001
```

Verification: `curl -s localhost:3001/agents` returns a non-empty list.

> `./scripts/dev.sh` (in any combination of flags) never starts
> `mcp/` — it only brings up Postgres, `server`, and `client`. The MCP server is always
> launched separately, as described below.

## 2. Install dependencies for the `mcp/` package

```bash
cd mcp
npm install
```

Installs `@modelcontextprotocol/sdk`, `zod`, `tsx`, `typescript`, `vitest`.

## 3. Verify compilation and green tests

```bash
npm run typecheck    # tsc --noEmit -p tsconfig.json
npm test              # vitest run — 22 tests
```

## 4. Start the server manually (without Claude Code)

```bash
npm run dev           # tsx src/index.ts — hangs, waiting for JSON-RPC on stdin
```

Environment variables (optional, have defaults):

| Var | Default | Purpose |
| --- | --- | --- |
| `DEVDIGEST_API_URL` | `http://localhost:3001` | Base URL of the running API |
| `RUN_POLL_BUDGET_MS` | `120000` (~2 min) | How long `devdigest_run_agent_on_pr` polls before returning `status:"running"` |
| `MCP_REQUEST_TIMEOUT_MS` | `4000` | Timeout for a single HTTP request (not the polling budget) |

## 5. Manual smoke test with a real stdio client

```js
// mcp/smoke.mjs (temporary file, delete after verification)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx', args: ['-y', 'tsx', 'src/index.ts'],
  cwd: process.cwd(), env: { ...process.env, DEVDIGEST_API_URL: 'http://localhost:3001' },
});
const client = new Client({ name: 'smoke', version: '0.0.0' });
await client.connect(transport);
console.log(await client.listTools());
console.log(await client.callTool({ name: 'devdigest_list_agents', arguments: {} }));
```

```bash
cd mcp && node smoke.mjs
```

Should output exactly 5 `devdigest_*` tools with annotations, then the result of the
`devdigest_list_agents` call (`content` + `structuredContent`).

⚠️ `devdigest_run_agent_on_pr` can block for up to ~2 minutes (poll budget). If
the MCP client has a shorter timeout — the call will fail with a transport error instead
of `{status:"running"}`.

## 6. Registration in Claude Code — and auto-connection control

The root `.mcp.json` registers the server in **project scope** (committed to git,
visible to the whole team):

```json
{ "mcpServers": { "devdigest": {
  "command": "npx", "args": ["-y", "tsx", "mcp/src/index.ts"],
  "env": { "DEVDIGEST_API_URL": "http://localhost:3001" } } } }
```

**How it works:** a project-scoped server requires explicit approval on first
use (`⏸ Pending approval` in `claude mcp list`). But after one confirmation, it auto-connects in **every subsequent** Claude Code session in this project. There is no built-in "on-demand by click" mechanism — no flag in `.mcp.json`, no ephemeral CLI flag, and `/mcp` panel manages only claude.ai connectors, not project stdio servers.

**To have the server documented for the team, but not auto-connected for you personally** — add to your **personal, not committed**
`.claude/settings.local.json`:

```json
{ "disabledMcpjsonServers": ["devdigest"] }
```

Result:
- `.mcp.json` stays in the repository — the team sees the server and can enable it separately.
- For you personally, it no longer auto-connects when opening Claude Code in this project.

**To start it "on demand" in Claude Code** — temporarily remove
`"devdigest"` from the `disabledMcpjsonServers` array (or delete the entire key) and restart the session; after you're done, restore the setting.

**Alternative, independent of `.mcp.json`/Claude Code** — the manual spawn script from step 5 (`mcp/smoke.mjs`): starts the server as a child process anytime, regardless of registration config.
