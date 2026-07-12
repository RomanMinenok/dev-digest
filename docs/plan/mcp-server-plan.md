# Development Plan — local MCP server `@devdigest/mcp` (5 tools via stdio)

> Status: **awaiting approval** (implementation not started).
> Plan version: after review via `onion-architecture` skill (4 clarifications below).

## 1. What this is and how it's structured

A new **6th standalone package** `@devdigest/mcp`, which Claude Code (or any MCP client) launches as a child process via **stdio** (JSON-RPC). Architecturally — a **thin HTTP client** over an already-running `@devdigest/api` (Fastify, `:3001`). No database / LLM / business logic of its own: translates 5 tools into REST calls and returns compact, machine-readable results.

The package lives by non-workspace convention (its own `tsconfig.json` + `package.json`; example — `e2e/`). No root `tsconfig.json`.

```
Claude Code ──stdio / JSON-RPC──▶ index.ts (McpServer, composition root)
                                   ├─ tools/*.ts        (presentation)
                                   ├─ services/*.ts     (application)
                                   ├─ resolver.ts       (application)
                                   ├─ ports.ts          (domain — port interface)
                                   ├─ schemas.ts / output-schemas.ts (domain — zod)
                                   └─ http-client.ts     (infrastructure) ──REST──▶ API :3001
                                   logs ─────────────────────────────────▶ stderr ONLY
```

## 2. Onion Architecture review — layer map and 4 clarifications

The skill is tied to `@devdigest/api` (Domain=`@devdigest/shared`, Application=`service.ts`, Infrastructure=`repository.ts`/adapters, Presentation=`routes.ts`, composition root=`platform/container.ts`). Our package has **no database/Fastify/DI container**, so we adapt **the discipline** (dependency rule "only inward" + ports/adapters), not the literal filenames. This is a deliberate, explicitly documented difference.

### Layer map for the MCP package

| Onion layer | Analog in `@devdigest/api` | MCP package files |
| --- | --- | --- |
| **Domain** | `@devdigest/shared` (zod contracts + ports) | `schemas.ts`, `output-schemas.ts`, `ports.ts` — zod + types only |
| **Application** | `service.ts` (use cases) | `resolver.ts`, `services/run-agent.service.ts`, `services/findings.service.ts` |
| **Infrastructure** | `repository.ts` / `adapters/*` | `http-client.ts` (adapter to REST), `config.ts`, `logger.ts` |
| **Presentation** | `routes.ts` (Fastify) | `tools/*.ts` (registerTool: zod I/O, annotations, descriptions, forming `content`+`structuredContent`) |
| **Composition root** | `platform/container.ts` | `index.ts` (builds concrete client, injects, `registerTool`×5, `connect`) |

The skill's golden rule `routes → service → port → adapter` becomes in our case: **`tools → services/resolver → ports (interface) → http-client`**. No arrow points outward.

### 4 clarifications from the skill (added to the base plan)

1. **Port interface for the HTTP client** (against anti-pattern #4 "concrete adapter constructed in service"). We introduce `ports.ts` with an interface `DevDigestApiClient` (methods `getAgents`, `startReview`, `getReviews`, `getConventions`, `listRepos`, `listPulls`). `http-client.ts` **implements** it; `resolver.ts` and `services/*` depend on the **interface**, not the concrete class. Plus for testability: in tests we inject a fake client instead of stubbing global `fetch`.

2. **Thin tools — business logic in application layer** (against anti-pattern #8 "business logic in routes"). The hybrid poll (`run_agent`) and summary/pagination/concise-detailed (`get_findings`) are **use cases**, not presentation. We move them to `services/run-agent.service.ts` and `services/findings.service.ts`. The tool handler only: parses input (zod) → calls service → formats `content`/`structuredContent`. Mirrors the existing pattern `assembleSmartDiff` (`server/INSIGHTS.md:34` — pure function, tested without wrapper).

3. **DI only in composition root** (`index.ts`), like `container.ts`. `index.ts` **once** builds concrete `HttpClient` (reading `config`) and `logger`, injects them into resolver/services/tools. No tool/service creates `new HttpClient()` and doesn't read `process.env` directly (against anti-pattern #6 "process.env inside an adapter").

4. **Error mapping — in presentation** (against anti-pattern #7 "HTTP status codes in service"). `http-client.ts` throws a typed `ApiError{status,code,message}`; the **tool handler** catches and maps it to an MCP result `isError:true` + readable text. Infrastructure doesn't format MCP results.

**Domain purity confirmed:** `schemas.ts`/`output-schemas.ts`/`ports.ts` import only `zod` + types, no framework; we do NOT pull `@devdigest/shared` (avoid vendor drift, `server/INSIGHTS.md:30`) — own minimal types for consumed fields.

## 3. Verified facts (from real code, `path:line`)

Routes are registered **flat**, without prefix (`server/src/app.ts:170`).

| Tool | Endpoint | Verification | Response shape |
| --- | --- | --- | --- |
| `devdigest_list_agents` | `GET /agents` | `modules/agents/routes.ts:74` → `service.list` | `Agent[]`: `id,name,description,provider,model,system_prompt,enabled,version,skill_count` (`vendor/shared/contracts/knowledge.ts:212`) |
| `devdigest_run_agent_on_pr` | `POST /pulls/:id/review` `{agentId}` | `modules/reviews/routes.ts:27` | `{pr_id, runs:[{run_id,agent_id,agent_name}], reviews:[]}` — `reviews` **always []** (fire-and-forget, `modules/reviews/service.ts:103-138`) |
| `devdigest_get_findings` | `GET /pulls/:id/reviews` | `modules/reviews/routes.ts:129` | `ReviewDto[]`: `id,pr_id,agent_id,run_id,agent_name,kind,verdict,summary,score,model,created_at,findings[]`; finding: `id,severity,category,title,file,start_line,end_line,rationale,suggestion,confidence,kind` (`modules/reviews/helpers.ts:12-74`) |
| `devdigest_get_conventions` | `GET /repos/:repoId/conventions` | `modules/conventions/routes.ts:13` | `ConventionCandidate[]`: `id,rule,evidence_path,evidence_snippet,confidence,accepted` (`knowledge.ts:171`) |
| `devdigest_get_blast_radius` | — (no endpoint) | grep routes — absent | STUB, deterministic |

### `pr_id` resolution (real problem — solved)

There is no single `repo+pr_number → pr_id` mapping; all `/pulls/:id/*` take **uuid** (`IdParams`, `modules/reviews/routes.ts:6`). Two-level resolver in MCP (chose **flat arguments**):
1. `GET /repos` → `Repo[]` (`id,owner,name,full_name`, `modules/repos/routes.ts:33`, `helpers.ts:44`) — match `repo` against `full_name`(priority)/`name` → `repoId`.
2. `GET /repos/:repoId/pulls` → returns `id` **and** `number` (`modules/pulls/routes.ts:200`) — match `pr_number` against `number` → `id` = `pr_id`.

The resolver — shared application helper (tools 2,3,5); tool 4 uses only step 1.

### Ahead-of-implementation
- `get_blast_radius` — intentional STUB (endpoint absent from all `server/src/modules`).
- `conventions` — real L02 feature; empty array — valid state (depends on `rescan`).

## 4. Insights applied from `server/INSIGHTS.md`
- `INSIGHTS.md:30` — vendor `@devdigest/shared` drifts, TS won't catch it → **own local zod types**, not import shared. `ReviewDto` lives in `server` anyway (not in shared), import impossible.
- `INSIGHTS.md:47` — `.default()` doesn't make a field optional in `z.infer` output → in fixtures `outputSchema` field must be stated explicitly.
- `agents/routes.ts:16` — API already uses `z.coerce.number()` for string values → `pr_number: z.coerce.number()` mandatory.
- `reviews/service.ts:131` — fire-and-forget → hybrid polls `GET /pulls/:id/reviews` separately and **correlates by `run_id`** (endpoint returns ALL reviews for PR — without filter would return others'/stale).

## 5. Contracts for 5 tools

All return `content` (human text) **and** `structuredContent` (object); `outputSchema` — where it's parsed programmatically. Lead fields — `name`/`title`/`file:line`/`severity`; internal uuid — secondary field (low-hallucination).

### `devdigest_list_agents`
- Endpoint: `GET /agents`. Input: empty schema.
- Annotations: `readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:false, title:"List reviewer agents"`.
- Description: *"Lists configured reviewer agents (agent_id, name, provider, model, enabled). Call this FIRST to obtain a valid agent_id — never invent one. Feed agent_id to devdigest_run_agent_on_pr."*

### `devdigest_run_agent_on_pr` (hybrid)
- Endpoint: `POST /pulls/:id/review` `{agentId}`. Input: `{repo, pr_number, agent_id}` (flat).
- Logic (application, `services/run-agent.service.ts`): `resolvePrId` → POST → take `run_id` from `runs[0]` → **poll** `GET /pulls/:id/reviews` (~1–2s interval) up to **~120s budget** (2 min), filtering by `run_id`. Completed → `{status:"completed", run_id, verdict, summary, findings_summary, findings[]}`; no (after 120s exhausted) → `{status:"running", run_id, poll_after_seconds:30}`. State machine append-only: started→running→completed|failed.
- **⚠ Deliberate difference from p.3.4:** budget increased from ~5s to **120s** by explicit owner decision. The tool now blocks up to ~2 min — effectively a Blocking model. Consequence: **MCP client timeout must be ≥120s** (in Claude Code — `MCP_TIMEOUT`/server config), otherwise very long reviews fail with transport error instead of graceful `running`. Budget moved to constant/env (`RUN_POLL_BUDGET_MS`, default 120000) for easy rollback.
- Annotations: `readOnlyHint:false, destructiveHint:false, idempotentHint:false, openWorldHint:true, title:"Run reviewer agent on a PR"`.
- Description: *"Starts a review of a PR by one agent (agent_id from devdigest_list_agents — don't invent it). Runs in background; waits up to ~2 min then returns findings if done, else {status:'running', run_id}. Then call devdigest_get_findings. NOT read-only: creates a review run."*

### `devdigest_get_findings` (summary-first + pagination + concise/detailed)
- Endpoint: `GET /pulls/:id/reviews`. Input: `{repo, pr_number, response_format:enum("concise","detailed").default("concise"), page:coerce.number().default(1), page_size:coerce.number().max(50).default(10)}`.
- Logic (application, `services/findings.service.ts`): `resolvePrId` → aggregate findings from all reviews (`kind:"review"`), extract `verdict`/`summary`. **Summary-first**: `content` starts with "N findings: X critical, Y warning, Z suggestion", then page ~10. `concise`=`title+severity+file`; `detailed` +`start_line/end_line`,`suggestion`,`finding_id`. Tolerate `verdict:null`. No raw reviewer trace. Pagination keeps output under limit (Claude Code warns >10k / `MAX_MCP_OUTPUT_TOKENS`).
- Annotations: `readOnlyHint:true, idempotentHint:true, openWorldHint:false, title:"Get PR review findings"`.
- Description: *"Returns findings for an already-run review of a PR (call devdigest_run_agent_on_pr first). Summary-first + paginated: leads with counts, then a page of ~10. Use response_format 'concise' (title+severity+file) or 'detailed' (adds line range, suggestion, finding_id)."*

### `devdigest_get_conventions`
- Endpoint: `GET /repos/:repoId/conventions`. Input: `{repo}`. **Tool, not Resource** (fixed).
- Logic: `resolveRepoId` → GET → map to `{rule, evidence_path, confidence, accepted}`. Empty → valid "not scanned (run rescan)", not an error.
- Annotations: `readOnlyHint:true, idempotentHint:true, openWorldHint:false, title:"Get repo conventions"`.
- Description: *"Returns coding conventions extracted for a repo (rule + evidence path + confidence). Pass repo as 'owner/name'. Empty result means no conventions have been scanned yet."*

### `devdigest_get_blast_radius` (STUB)
- Endpoint: none. Input: `{repo, pr_number}` (for future compatibility), **0 HTTP calls**.
- Logic: always `{status:"not_implemented", message:"Blast radius is not implemented yet — proceed without it; do not rely on this tool."}`. **Never throws.**
- Annotations: `readOnlyHint:true, idempotentHint:true, openWorldHint:false, title:"Get PR blast radius (not implemented)"`.
- Description: *"STUB — blast radius is NOT implemented. Always returns status:'not_implemented'. Do not rely on it; proceed without blast-radius data."*

## 6. Hard rule for stdio
In stdio stdout is reserved for JSON-RPC — **any `console.log` breaks framing**. All logs exclusively `stderr` (`console.error`) / `server.sendLoggingMessage()`. Baked into `logger.ts` (infrastructure), README, and each tool.

## 7. Task breakdown ([P] = can run in parallel)

### Scaffold
- **T1 `package.json`** — `@devdigest/mcp`, `private`, `type:module`. deps: `@modelcontextprotocol/sdk`^1.x (v2 beta NOT), `zod`. devDeps: `tsx,typescript,@types/node,vitest`. scripts: `dev`(tsx), `typecheck`, `test`. Skills: `typescript-expert`,`security`. [P]
- **T2 `tsconfig.json`** — per `e2e/tsconfig.json` template (Bundler/ESM/noEmit/strict). NO `paths` to shared. Skills: `typescript-expert`. [P]
- **T3 `config.ts`** (infra) — `DEVDIGEST_API_URL` (default `http://localhost:3001`), trim `/`. Secrets via env only. Skills: `security`,`typescript-expert`. [P]
- **T4 `logger.ts`** (infra) — **stderr-only**. Skills: `typescript-expert`,`security`. [P]

### Domain
- **T5 `schemas.ts`** — shared flat input schemas + `.describe()`: `RepoArg`, `PrNumberArg=z.coerce.number().int().positive()`, `page/page_size`. Skills: `zod`,`typescript-expert`. (deps: T2)
- **T6 `output-schemas.ts`** — `AgentOut`, `RunResultOut` (discriminated union completed|running), `FindingsPageOut`, `ConventionOut`, `BlastRadiusOut`; uuid — secondary field. Skills: `zod`,`typescript-expert`. (deps: T2)
- **T7 `ports.ts`** *(Onion clarification #1)* — interface `DevDigestApiClient` (`getAgents/startReview/getReviews/getConventions/listRepos/listPulls`) + types `ApiError`. Zod/types only. Skills: `typescript-expert`,`zod`. (deps: T2)

### Infrastructure
- **T8 `http-client.ts`** — **implements** `DevDigestApiClient`. `apiGet/apiPost`, `AbortController` timeouts **per single request** (≈4s GET) — this is NOT total polling budget (poll loop in `run-agent.service` runs many such requests up to 120s loop deadline). Non-2xx → `ApiError` (parse `{error:{code,message}}`, `app.ts:157`), network fail → readable error, 429 → readable. `encodeURIComponent` on uuid in path. Does NOT format MCP results (only throws `ApiError`). Skills: `typescript-expert`,`security`. (deps: T3,T4,T7)

### Application
- **T9 `resolver.ts`** — depends on `DevDigestApiClient` (interface, injected). `resolveRepoId(repo)`, `resolvePrId(repo,pr_number)`; ambiguity/absence → readable error with options. Cache repos within one call. Skills: `typescript-expert`,`security`. (deps: T7,T8)
- **T10 `services/run-agent.service.ts`** *(Onion clarification #2)* — use case (start+poll+correlation by `run_id`+budget **120s**, moved to `RUN_POLL_BUDGET_MS`). Pure, tested without MCP wrapper. Skills: `typescript-expert`,`zod`. (deps: T7,T9)
- **T11 `services/findings.service.ts`** *(Onion clarification #2)* — aggregate findings, summary line, pagination, concise/detailed shaping. Skills: `typescript-expert`,`zod`. (deps: T7,T9)

### Presentation (thin tools)
- **T12 `tools/list-agents.ts`** — GET /agents → map; `content`+`structuredContent`; catch `ApiError`→`isError`. Skills: `zod`,`typescript-expert`,`security`. [P] (deps: T7,T6,T8)
- **T13 `tools/get-conventions.ts`** — `resolveRepoId`→GET; empty→message. Skills: `zod`,`typescript-expert`,`security`. [P] (deps: T9,T6)
- **T14 `tools/get-blast-radius.ts`** — STUB, 0 HTTP. Skills: `zod`,`typescript-expert`. [P] (deps: T6)
- **T15 `tools/run-agent-on-pr.ts`** — thin: parse → `run-agent.service` → format. Skills: `zod`,`typescript-expert`,`security`. (deps: T10,T6)
- **T16 `tools/get-findings.ts`** — thin: parse → `findings.service` → format. Skills: `zod`,`typescript-expert`,`security`. (deps: T11,T6)

### Composition root
- **T17 `index.ts`** *(Onion clarification #3)* — `new McpServer` → **once** builds `HttpClient(config)`+`logger`, injects into resolver/services/tools → `registerTool`×5 (unique `devdigest_*`) → `connect(StdioServerTransport)`. Global errors → stderr. Exactly 5 tools, no tool-search/code-execution. Skills: `typescript-expert`,`security`. (deps: T12–T16,T4)

### Tests (vitest, mock — inject fake `DevDigestApiClient`, not global fetch where possible)
- **T18** `http-client.test.ts` — 2xx/4xx(ApiError)/network-fail/timeout. [P] (deps: T8)
- **T19** `resolver.test.ts` — full_name & name match; unknown repo/number → clear error. [P] (deps: T9)
- **T20** `run-agent.service.test.ts` — fake-timers (mandatory — otherwise test waits 2 min): appears by budget→completed (only our `run_id`); no→running after `RUN_POLL_BUDGET_MS` exhausted (in test override budget to small). [P] (deps: T10)
- **T21** `findings.service.test.ts` — concise<detailed; summary line; pagination; empty→"0 findings". [P] (deps: T11)
- **T22** tool tests (list-agents/get-conventions/get-blast-radius) — form `content`+`structuredContent`; stub always not_implemented. [P] (deps: T12,T13,T14)
- Skills for tests: `typescript-expert` (+`zod` where schemas).

### Release
- **T23 `.mcp.json`** (root, project-scope, in git):
  ```json
  { "mcpServers": { "devdigest": {
    "command": "npx", "args": ["-y","tsx","mcp/src/index.ts"],
    "env": { "DEVDIGEST_API_URL": "http://localhost:3001" } } } }
  ```
  Document dependency: **`@devdigest/api` must be running** (`./scripts/dev.sh`). Skills: `security`. (deps: T17)
- **T24 `mcp/README.md`** — purpose, prerequisite (API up), env (`DEVDIGEST_API_URL`, `RUN_POLL_BUDGET_MS`), **MCP client timeout requirement ≥120s** for `run_agent_on_pr`, registration, 5 contracts, **stdio rule**, blast-radius limitation, note on pr-id resolution. (deps: T17,T23)

## 8. Changes outside the MCP package
**No code changes** in `server/` / `client/` / `reviewer-core/` / `e2e/` (all 5 tools map to existing endpoints; server-side calls → CORS not involved; `LocalNoAuthProvider` no headers). Only adds:
- new root `.mcp.json` (config, not code);
- (optional) mention of new package in root `README.md`/`CLAUDE.md`.

Deliberately NOT doing (keep server untouched): separate server lookup `repo+number→pr_id`; real blast-radius endpoint.

## 9. End-to-end verification (E2E)
1. `./scripts/dev.sh` → wait for `DevDigest API listening on http://localhost:3001` (`server/src/server.ts:30`).
2. Manual API check: `curl -s localhost:3001/agents`; `curl -s localhost:3001/repos` (note `full_name`).
3. MCP via stdio without client: send `initialize` to process `npx -y tsx mcp/src/index.ts` (env `DEVDIGEST_API_URL`), then `tools/list` → exactly 5 `devdigest_*` with correct annotations; **stdout only valid JSON-RPC** (logs to stderr).
4. Via Claude Code from `.mcp.json` (ensure MCP client timeout ≥120s): `list_agents`→`agent_id`; `run_agent_on_pr{repo,pr_number,agent_id}`→completed|running, **can block up to ~2 min**; `get_findings{...,concise}`→summary+page, then `detailed`; `get_conventions{repo}`; `get_blast_radius`→not_implemented.
5. In `mcp/`: `pnpm test` (vitest) green; `pnpm typecheck` clean.

**Success criterion:** 5 tools visible, correct `content`+`structuredContent`; `run_agent` completes within 120s budget (or returns `running`); findings correlate by `run_id`; no tool writes to stdout; tests & typecheck green.

## 10. Out of scope
Changes in server/client/reviewer-core/e2e; blast-radius endpoint implementation; remote transport/OAuth/multi-workspace; dynamic tool-search / code-execution tool; SSE streaming in MCP (hybrid-poll sufficient); conversion to pnpm-workspace member; import/extend `@devdigest/shared`.

## 11. Risks / open points
- `run_id` correlation POST↔`ReviewDto.run_id` — confirmed in code (`createAgentRun`→`run_id`=`agent_runs.id`, `service.ts:120`); test T20 locks it down.
- `verdict` can be `null` until LLM completes (`helpers.ts:63`) — tool tolerates (shows findings without verdict).
- Ambiguous `repo` (same `name`, different owner) → resolver requires `owner/name` + options (T9/T19).
- Rate limit `POST /review` 10/min (`reviews/routes.ts:29`), global 120/min (`app.ts:100`) → http-client maps 429 (T8).
- Empty database findings right after start — expected (fire-and-forget); `get_findings` → "0 findings", agent must wait for `completed`/poll.
- **Poll budget 120s (owner decision, deviation from p.3.4):** `run_agent_on_pr` blocks up to 2 min. **Risk:** if MCP client timeout <120s — call fails with transport error, not return `running`. Mitigation: budget in env `RUN_POLL_BUDGET_MS` (easy rollback to ~5s), README requires client timeout raise; per-request GET timeout (~4s) stays separate and small.

## 12. Skills matrix (summary)
Applicable from skill table: `typescript-expert`, `zod`, `security`. `onion-architecture` — applied as **design principle** (this section), not formally assigned per-task. NOT applicable (no Fastify/DB/UI): `fastify-best-practices`, `drizzle-orm-patterns`, `postgresql-table-design`, React skills. Package `mcp/` is formally outside any Skills table row (it's outside `server/src/**`,`client/**`,`reviewer-core/**`) — this is honestly recorded.
