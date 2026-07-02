# Conventions Extractor — Technical Implementation Plan

> Audience: engineers/agents executing the work. Assumes familiarity with the
> repo conventions in root `CLAUDE.md`, `server/CLAUDE.md`, `client/CLAUDE.md`.
> Read `server/INSIGHTS.md` + `client/INSIGHTS.md` before touching a module.

## 0. Context & current state

Goal: hook real logic to the **Re-scan** button on `/conventions`. A scan
clones-aware reads config + representative source files, asks an LLM to extract
**concrete, evidenced** coding conventions, **verifies** each candidate against
the real file on disk (anti-hallucination gate), and persists verified
candidates to the existing `conventions` table.

### What already exists and must be reused (do NOT recreate)

| Asset | Location | State |
|---|---|---|
| Table `conventions` (`rule, evidencePath, evidenceSnippet, confidence, accepted`, fk `workspaceId`+`repoId`) | `server/src/db/schema/knowledge.ts:31` | Migrated (`0000_init.sql`). **No migration needed.** |
| Contract `ConventionCandidate` = `{ id, rule, evidence_path, evidence_snippet, confidence(0..1), accepted }` | `server/src/vendor/shared/contracts/knowledge.ts:171` **and** client copy | Present on both sides. |
| Feature model id `'conventions'` (+ registry default) | `server/src/vendor/shared/contracts/platform.ts:73` | `resolveFeatureModel(container, ws, 'conventions')`. |
| `RepoIntel.getConventionSamples(repoId, n)` → top-N source paths (tests/configs/migrations stripped) | `server/src/modules/repo-intel/service.ts:630` | The `samplePaths` source. Returns `[]` when repo-intel disabled/unindexed. |
| `LLMProvider.completeStructured<T>({ model, messages, schema, schemaName, temperature })` | `server/src/adapters/llm/openai.ts:88`, `anthropic.ts` | Zod-validated structured output. `container.llm(provider)` builds it. |
| `MockLLMProvider` (fixture for `completeStructured`) | `server/src/adapters/mocks.ts:58` | For unit tests via `ContainerOverrides.llm`. |
| Repo clone path + ref | `RepoRow.clonePath`, `container.git.readFile(ref, path)` / `readFile(join(clonePath, path))` | Repos resolved via `container.reposRepo` / repos repository `getById(ws, id)`. |
| Client page (mocked) | `client/src/app/conventions/_components/ConventionsView/*` | `MOCK_CONVENTIONS`, no repo, Re-scan is a no-op button. |

### Project engineering rules to honor (non-negotiable)
> These are DevDigest's house rules for *how this module is written* — not the
> coding conventions the extractor discovers in the target repo (that's the
> feature's runtime output).
- Onion layering: `routes.ts` (Presentation) → `service.ts` (Application) →
  `repository.ts` (Infrastructure); pure logic in `extractor.ts`/`helpers.ts`.
- Workspace-scope **every** query (`getContext` → `workspaceId`).
- Modules use `container.*` getters, never reach into another module's folder
  (use `container.repoIntel`, `container.git`, `container.llm`, repos repo).
- DTO fields are `snake_case` (match contracts); Drizzle columns are camelCase.
- Client talks to the server **only** through `src/lib/api.ts`; hooks under `src/lib/hooks/`.
- i18n keys in `client/messages/en/conventions.json`; keep in sync.
- The extractor (`extractor.ts`) is **pure-ish**: it takes already-resolved
  inputs (`clonePath`, `samplePaths`, an `LLMProvider`, a `model`) and does only
  file reads + the LLM call + verification. No DB, no container, no HTTP — so it
  is trivially unit-testable with a `MockLLMProvider` and a temp dir.

---

## Phase 1 — Contracts (request/response for the route)

`ConventionCandidate` already exists. Add **two** small contracts to **both**
vendored `knowledge.ts` copies (server + client), near the Conventions block:

- `ConventionScanResult = z.object({ repo_id: z.string(), repo_name: z.string(), sample_count: z.number().int(), scanned_at: z.string(), candidates: z.array(ConventionCandidate) })`
- (reuse `ConventionCandidate` for the `GET` list response: `z.array(ConventionCandidate)`).

Export `z.object` + `z.infer` in the file's existing style. Mirror to both copies
(client `INSIGHTS.md`: a missed mirror is a silent client typecheck break).

**Acceptance:** server + client `pnpm typecheck` pass; `ConventionScanResult`
importable from `@devdigest/shared` on both sides.

---

## Phase 2 — Server: `extractor.ts` (the core, pure)

New file `server/src/modules/conventions/extractor.ts`.

### T2.1 — Inputs & output types
```ts
export interface ExtractInput {
  repoName: string;
  clonePath: string;        // absolute path to the cloned repo
  samplePaths: string[];    // capped to MAX_SAMPLES (12) by the caller; re-capped here defensively
  llm: LLMProvider;
  model: string;
}
// Draft = candidate before it gets an id/accepted/persistence
export interface ConventionDraft {
  rule: string;
  evidence_path: string;
  evidence_snippet: string;
  confidence: number;       // 0..1
}
export async function extractConventions(input: ExtractInput): Promise<ConventionDraft[]>
```

### T2.2 — Step 1: read config files (explicit conventions, no LLM judgment)
- `CONFIG_FILES` constant (glob-free, exact + a few variants):
  `tsconfig.json`, `.eslintrc`, `.eslintrc.js`, `.eslintrc.cjs`, `.eslintrc.json`,
  `eslint.config.js`, `eslint.config.mjs`, `.prettierrc`, `.prettierrc.json`,
  `.prettierrc.js`, `prettier.config.js`, `biome.json`, `biome.jsonc`, `.editorconfig`.
- Read each via `readFile(join(clonePath, name))` wrapped in `.catch(() => null)`;
  keep the ones that exist. These are **included in the LLM file payload** (the
  system prompt allows a single-occurrence rule **iff** it's configured explicitly).

### T2.3 — Step 2: read up to 12 representative source files
- `const paths = samplePaths.slice(0, MAX_SAMPLES);` (MAX_SAMPLES = 12).
- Read each from `clonePath`; skip unreadable. Truncate each file to a budget
  (`MAX_FILE_CHARS`, e.g. 8_000) to bound tokens; note truncation in the payload.

### T2.4 — Step 3+4: build messages
These two strings are sent **exactly as written below** (constants in the
extractor). `{repoName}` and `{fileContents}` are the only interpolations.

**System message:**
```
You are a code-convention analyst. Analyze the provided code samples and
extract concrete coding conventions consistently followed in this repository.
Return ONLY conventions that: have clear evidence in the provided files,
can be formulated as a specific actionable rule (start with Always/Never/Use X
instead of Y), appear in at least 2 places or are configured explicitly,
would be useful for a code reviewer to enforce.
Do NOT include generic best practices obvious to any TypeScript developer,
things with only 1 example unless in a config file, or framework defaults.
```

**User message** (template):
```
Repository: {repoName}
Analyze these files and extract coding conventions:
{fileContents}
Return JSON with candidates array: rule (imperative form), evidence_path (relative path), evidence_snippet (2-5 lines of exact code), confidence (0.0-1.0). Only include conventions with confidence > 0.6.
```

`{fileContents}` = each config + sample file rendered as (configs first, then
source samples), content truncated to `MAX_FILE_CHARS`:
```
--- {relativePath} ---
{content}
```

### T2.5 — Step 5a: structured parse
- Zod schema local to the extractor:
  `const ExtractionResponse = z.object({ candidates: z.array(z.object({ rule: z.string(), evidence_path: z.string(), evidence_snippet: z.string(), confidence: z.number().min(0).max(1) })) })`.
- `const res = await input.llm.completeStructured({ model, schemaName: 'conventions', schema: ExtractionResponse, temperature: 0, messages: [...] })`.
- Filter `confidence > 0.6` (belt-and-suspenders; prompt already asks).

### T2.6 — Step 5b: VERIFY each candidate (anti-hallucination gate)
- For each candidate: read the real file at `join(clonePath, evidence_path)`
  (`.catch(() => null)`; a path that doesn't exist → drop).
- Take `firstLine = evidence_snippet.split('\n')[0].trim()`; **drop** the candidate
  unless `fileContent.includes(firstLine)` (after the same trim per source line).
  Empty first line → drop. This kills hallucinated `file:line` references.
- Keep verified candidates only; return as `ConventionDraft[]`.

**Pure-function design** means T2 ships with its own unit test (Phase 6) with no DB.

---

## Phase 3 — Server: `repository.ts` + `service.ts` + `routes.ts`

New module `server/src/modules/conventions/`.

### T3.1 — `repository.ts` (`ConventionsRepository`)
Mirror an existing small repo (e.g. `repos/repository.ts`). Constructor `(db)`.
- `listForRepo(workspaceId, repoId): Promise<ConventionRow[]>` — `and(eq(workspaceId), eq(repoId))`.
- `replaceAll(workspaceId, repoId, drafts: ConventionDraft[]): Promise<ConventionRow[]>`
  — in a **transaction**: `DELETE FROM conventions WHERE workspaceId AND repoId`,
  then bulk-`insert` the drafts (`rule, evidencePath, evidenceSnippet, confidence,
  accepted: false`, `workspaceId`, `repoId`), `returning()` the inserted rows.
  Empty drafts → just delete, return `[]`.
- (optional) `setAccepted(workspaceId, id, accepted): Promise<ConventionRow | undefined>` — only if Phase 5 persists accept/reject (see Decision A).
- Add `ConventionRow = typeof t.conventions.$inferSelect;` to `server/src/db/rows.ts`; re-export from the repo.

### T3.2 — `helpers.ts` (pure)
- `toConventionDto(row: ConventionRow): ConventionCandidate` — snake_case map
  (`evidence_path: row.evidencePath ?? ''`, `evidence_snippet: row.evidenceSnippet ?? ''`,
  `confidence: row.confidence ?? 0`, `accepted: row.accepted`).

### T3.3 — `service.ts` (`ConventionsService`)
Constructor `(container)`. Methods:
- `list(workspaceId, repoId): Promise<ConventionCandidate[]>` — repo guard (404
  if repo not in workspace via repos repo `getById`), map rows → DTO.
- `rescan(workspaceId, repoId): Promise<ConventionScanResult>`:
  1. `repo = await reposRepo.getById(workspaceId, repoId)`; 404 if missing;
     `BadRequestError` if `!repo.clonePath` ("repo not cloned yet — index it first").
  2. `samplePaths = await container.repoIntel.getConventionSamples(repoId, 12)`.
     **Fallback** when empty (repo-intel disabled/unindexed): walk the clone for
     up to 12 source files (reuse `repo-intel/pipeline/walk.ts` `walkClone`, or a
     minimal local walk filtered to `.ts/.tsx/.js/.jsx` minus junk) so the scan
     still works on a fresh repo. Keep the fallback isolated in `helpers.ts`.
  3. `{ provider, model } = await resolveFeatureModel(container, workspaceId, 'conventions')`.
  4. `llm = await container.llm(provider)`.
  5. `drafts = await extractConventions({ repoName: repo.fullName, clonePath: repo.clonePath, samplePaths, llm, model })`.
  6. `rows = await repo.replaceAll(workspaceId, repoId, drafts)`.
  7. Return `{ repo_id, repo_name: repo.fullName, sample_count: samplePaths.length, scanned_at: new Date().toISOString(), candidates: rows.map(toConventionDto) }`.
- Wrap the LLM call so a provider/config error surfaces as a clean `ExternalServiceError`/`ConfigError` (already thrown by `container.llm`) — the route maps to 5xx/4xx via existing error middleware.

### T3.4 — `routes.ts` (Fastify, `ZodTypeProvider`)
`new ConventionsService(app.container)`, `getContext` for `workspaceId`. Repo-scoped
paths (match `repo-intel` style `/repos/:repoId/...`):

| Method | Path | Handler |
|---|---|---|
| `GET`  | `/repos/:repoId/conventions` | `service.list(workspaceId, repoId)` → `ConventionCandidate[]` |
| `POST` | `/repos/:repoId/conventions/rescan` | `service.rescan(workspaceId, repoId)` → `ConventionScanResult` |

- Param schema: `z.object({ repoId: z.string().uuid() })`.
- `rescan` is synchronous (one LLM call, seconds) — keep it a plain awaited POST
  (no job queue) to match the button's request/response UX. Note a generous route
  timeout if the framework imposes one.

### T3.5 — Wire module + container
- `server/src/modules/index.ts`: `import conventions from './conventions/routes.js';` add `conventions,` to the `modules` record.
- `server/src/platform/container.ts`: add a lazy getter
  `get conventionsRepo(): ConventionsRepository { return (this._conventionsRepo ??= new ConventionsRepository(this.db)); }`
  (only if other modules need it; the service can also `new` it directly like
  agents/skills do — match the prevailing pattern in this repo).

**Acceptance:** server typecheck + lint pass. `POST /repos/:id/conventions/rescan`
on a cloned+indexed repo returns verified candidates and rows land in
`conventions` (replacing prior rows for that repo). `GET` returns them.
Hallucinated snippet (first line absent from file) is dropped.

---

## Phase 4 — Client: API hooks

New `client/src/lib/hooks/conventions.ts` (mirror `lib/hooks/repo-intel.ts`):
- `useConventions(repoId)` → `GET /repos/:repoId/conventions` (`['conventions', repoId]`, `enabled: !!repoId`).
- `useRescanConventions(repoId)` → `POST /repos/:repoId/conventions/rescan`;
  on success `qc.setQueryData(['conventions', repoId], res.candidates)` (and/or
  invalidate). Expose `isPending` for the button spinner.

No direct `fetch` outside `api.ts`.

---

## Phase 5 — Client: wire `ConventionsView` to real data

`client/src/app/conventions/_components/ConventionsView/`.

### T5.1 — Repo selection (use the existing top-left selector)
- Read the active repo from `useActiveRepo()` (`client/src/lib/repo-context.tsx`)
  — the same context the shell's top-left repo selector drives (`repoId`,
  `activeRepo`, `reposLoaded`). **Do not** add a new picker or re-derive
  `useRepos()[0]`.
- Use `repoId` for `useConventions` / `useRescanConventions` (`enabled: !!repoId`).
  Use `activeRepo?.fullName` for header copy.
- Edge states: while `!reposLoaded` → `Skeleton`; when loaded and `repoId == null`
  (zero repos) → `EmptyState` ("Connect a repo first"). Reuse `useRepoNotFound`
  if a stale selection needs the friendly empty state.

### T5.2 — Replace mock with fetched data
- Drop `MOCK_CONVENTIONS`/`MOCK_*` usage in `ConventionsView.tsx`. Map each
  `ConventionCandidate` → the existing card shape via a small adapter:
  `{ id, title: c.rule, file: c.evidence_path, code: c.evidence_snippet, confidence: Math.round(c.confidence * 100) }`.
  Keep `ConventionCard.tsx` / `styles.ts` as-is (only the data source changes).
- Header copy: `repo_name` from the scan result (or repo full name); `sample_count`
  and a relative "scanned Xh ago" from `scanned_at` (replace `MOCK_*`).
- States: loading `Skeleton`, error `ErrorState`, empty `EmptyState`
  ("No conventions yet — run a scan").

### T5.3 — Re-scan button
- `onClick={() => rescan.mutate()}`; `loading={rescan.isPending}` + disable while pending.
- On success the list refreshes from the mutation result. Accept/reject stays
  **client-local** for now (see Decision A) — `initStatuses` keys off the fetched
  candidate ids.

### T5.4 — i18n
- Extend `client/messages/en/conventions.json` for any new copy (loading/error/empty,
  "scanning…", scanned-ago). Keep keys in sync.

**Acceptance:** opening `/conventions` lists persisted conventions for the repo;
clicking **Re-scan** runs the server extractor, shows a spinner, and renders the
new verified set; zero-repo and error states render cleanly.

---

## Phase 6 — Tests

### T6.1 — Server (vitest)
- `extractor.test.ts` (the high-value one): temp dir with a couple of fixture
  files + a `MockLLMProvider` returning candidates where **one snippet matches**
  the file and **one is hallucinated** → assert only the matching one survives;
  assert `confidence <= 0.6` dropped; assert config files are included in the
  prompt payload (inspect `mock.calls[0].req.messages`).
- `service.test.ts` / `routes.test.ts`: `rescan` calls `repository.replaceAll`
  with verified drafts and returns `ConventionScanResult`; workspace scoping
  (cross-tenant repo → 404); `!clonePath` → 400; `GET` returns DTOs.
- `repository.test.ts`: `replaceAll` deletes prior rows for the repo then inserts
  (idempotent re-scan), `accepted` defaults false.

### T6.2 — Client (RTL)
- `ConventionsView` renders fetched candidates (mapped to card shape); Re-scan
  click triggers the mutation and renders the new set; empty/error states.

**Acceptance:** `pnpm test` green in server + client; `pnpm typecheck` + `pnpm lint` clean.

---

## Decisions (confirmed)

- **A. Accept/Reject** → **client-local** (as today). No `accepted` persistence;
  `setAccepted`/PATCH route are NOT built. Re-scan is the only new server behavior.
- **B. Repo selection** → use the existing **top-left selector** via
  `useActiveRepo()` (no new picker). See T5.1.
- **C. Rescan transport** → **synchronous awaited POST**. No job queue / polling.

## Out of scope (explicit)
- The "Create skill" button (turning accepted conventions into a Skill).
- A background/scheduled re-scan, job queue, or SSE progress.
- Embeddings / dedup of conventions across scans.
- New DB migration (the `conventions` table already exists).

## Sequencing
1 → 2 → 3 (server) can land together; 4 depends on 1+3; 5 depends on 4; 6
throughout. New deps: **none**. Migrations: **none**. Contract changes mirrored
to **both** vendored `knowledge.ts` copies.
