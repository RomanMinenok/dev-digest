# `@devdigest/mcp`

Local MCP server (stdio) that gives Claude Code — or any MCP client — 5 tools for driving
DevDigest PR reviews. It is a thin HTTP client over the already-running `@devdigest/api`
(`http://localhost:3001`); it has no database, LLM, or business logic of its own.

## Prerequisite

`@devdigest/api` must already be running (`./scripts/dev.sh` from the repo root, or
`./scripts/dev.sh --db-only` + the server started separately). This package makes no
attempt to start the API itself.

## Configuration (env)

| Var | Default | Purpose |
| --- | --- | --- |
| `DEVDIGEST_API_URL` | `http://localhost:3001` | Base URL of the running API |
| `RUN_POLL_BUDGET_MS` | `120000` (~2 min) | How long `devdigest_run_agent_on_pr` polls before returning `status:"running"` |
| `MCP_REQUEST_TIMEOUT_MS` | `4000` | Per-HTTP-request timeout (not the poll budget) |

**Important:** because `devdigest_run_agent_on_pr` can block for up to ~2 minutes, your
MCP client's own request timeout must be **≥120s** (matching `RUN_POLL_BUDGET_MS`),
otherwise a long-running review will fail with a transport timeout instead of returning
gracefully as `{status:"running"}`.

## Registering with Claude Code

The repo root `.mcp.json` already registers this server (project scope):

```json
{ "mcpServers": { "devdigest": {
  "command": "npx", "args": ["-y", "tsx", "mcp/src/index.ts"],
  "env": { "DEVDIGEST_API_URL": "http://localhost:3001" } } } }
```

## The 5 tools

1. **`devdigest_list_agents`** — `GET /agents`. Lists configured reviewer agents. Call
   this first to get a valid `agent_id` — never invent one.
2. **`devdigest_run_agent_on_pr`** — `POST /pulls/:id/review`. Starts a review run and
   polls (`GET /pulls/:id/reviews`, correlated by `run_id`) up to `RUN_POLL_BUDGET_MS`.
   Returns `{status:"completed", findings, verdict, ...}` or `{status:"running", run_id,
   poll_after_seconds}`. Not read-only — it creates a review run.
3. **`devdigest_get_findings`** — `GET /pulls/:id/reviews`. Summary-first + paginated
   findings for an already-run review. `response_format: "concise"|"detailed"`.
4. **`devdigest_get_conventions`** — `GET /repos/:repoId/conventions`. Coding conventions
   extracted for a repo. Empty result is valid (not yet scanned).
5. **`devdigest_get_blast_radius`** — **STUB**. No such endpoint exists server-side yet;
   always returns `{status:"not_implemented"}` and never throws. Do not rely on it.

All 5 accept `repo` as `owner/name` (matched against `full_name`, falling back to a
unique `name` match) and `pr_number` (not the internal PR uuid) — the server has no
single `repo+number → pr_id` lookup, so this package resolves it via
`GET /repos` → `GET /repos/:repoId/pulls`.

## stdio rule

stdout is reserved for JSON-RPC framing. This package never calls `console.log` —
all logs go to `console.error` (stderr) via `src/logger.ts`.

## Development

```bash
cd mcp
npm install
npm run typecheck
npm test
npm run dev   # runs the server directly over stdio (for manual JSON-RPC probing)
```
