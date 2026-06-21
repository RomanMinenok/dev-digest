# Skills Feature — Technical Implementation Plan

> Audience: engineers/agents executing the work. Assumes familiarity with the
> repo conventions in root `CLAUDE.md`, `server/CLAUDE.md`, `client/CLAUDE.md`.
> Read the relevant `INSIGHTS.md` before touching a module.

## 0. Context & current state

DevDigest is 5 path-aliased packages (not a pnpm workspace): `server`
(`@devdigest/api`, Fastify + Drizzle/Postgres), `client` (`@devdigest/web`,
Next.js 15 + Mantine), `reviewer-core` (pure engine), `e2e`, and vendored
`@devdigest/shared` contracts (duplicated under `server/src/vendor/shared/` and
`client/src/vendor/shared/`).

The Skills feature is **heavily pre-scaffolded** (course lessons land schema +
contracts ahead of implementation). What already exists and must be reused:

| Asset | Location | State |
|---|---|---|
| Tables `skills`, `skill_versions`, `agent_skills` | `server/src/db/schema/skills.ts`, `agents.ts` | Migrated in `0000_init.sql`. No migration needed except §Phase 1 `summary` column. |
| Contracts `Skill`, `SkillType`, `SkillSource`, `CommunitySkill`, `AgentSkillLink`, `AgentVersionConfig` | `*/vendor/shared/contracts/knowledge.ts` (BOTH copies) | Present on server **and** client. |
| Agent-side link API `GET/POST /agents/:id/skills` (set/reorder/link) | `server/src/modules/agents/{routes,service,repository}.ts` | Implemented. Snapshots linked skill ids into `agent_versions`. |
| Engine skills support: `assemblePrompt({ skills })` → `## Skills / rules` block; `reviewPullRequest({ skills })` | `reviewer-core/src/prompt.ts`, `reviewer-core/src/review/run.ts` | Implemented. `PromptAssembly.skills` is emitted. |
| Trace renders `prompt_assembly.skills` block | `client/.../RunTraceDrawer/_components/TraceBody/TraceBody.tsx:75` | Implemented. Appears when non-null. |
| i18n namespaces | `client/messages/en/skills.json`, `agents.json` (`editor.tabs.skills`, `skills.*`) | Pre-written; extend as noted. |
| UI kit | `client/src/vendor/ui` — `Markdown`, `Donut`, `MetricCard`, `Sparkline`, `Tabs`, `Badge`, `Toggle`, `Dropdown`, `Button`, `FormField`, `SelectInput`, `SearchableSelect`, `Textarea`, `EmptyState`, `ErrorState`, `Skeleton`, `Icon` | Available. |

**The one behavioral gap (keystone):** `server/src/modules/reviews/run-executor.ts`
never loads or passes the agent's linked skill bodies into `reviewPullRequest`.
Today, linking a skill to an agent has **zero** effect on a review. Phase 3 fixes
this.

### Product decisions already locked
- Scope: **mechanics + seed demo** (CRUD + editor + agent Skills tab + run wiring + trace + seed agents/skills).
- Import sources: **manual create + single markdown file + zip archive** (server extracts the markdown core; executable/binary entries ignored). **No** URL/community import.
- Skill-in-prompt gate: a skill body is injected **iff it is linked to the agent AND `skill.enabled === true`**.
- Skill detail = tabbed editor: **Config · Preview · Evals · Stats · Versions**.
- **Evals** tab + "Run on evals" button = empty stub (no eval module exists).
- **Stats** tab = built; real subset (`Used by N agents` + agents-using list), placeholders for pull%/accept%/findings (no finding→skill attribution).
- **Versions** tab = full: list + diff + restore + new nullable `summary` column.
- Imported skills persist `source='extracted'`, `enabled=false` (vet-before-enable).

### Conventions to honor (non-negotiable)
- Onion layering per module: `routes.ts` (Presentation) → `service.ts` (Application) → `repository.ts` (Infrastructure); pure mapping/logic in `helpers.ts`. See `onion-architecture` skill.
- Workspace-scope **every** query (`getContext` → `workspaceId`).
- Modules use `container.*Repo`, never reach into another module's folder.
- Cross-cutting row types live in `server/src/db/rows.ts`; the owning repo re-exports.
- Mirror any contract change to **both** vendored copies (server + client). (client `INSIGHTS.md`: silent client typecheck break otherwise.)
- Client talks to the server **only** through `src/lib/api.ts`. Add hooks under `src/lib/hooks/`.
- Route-local components live in `_components/`; styles in `styles.ts`, constants in `constants.ts`, helpers in `helpers.ts` (see `react-component-architecture` skill).
- i18n keys live in `client/messages/en/<ns>.json`; keep keys in sync when adding copy.
- DTO field naming is `snake_case` (matches contracts); DB columns are camelCase in Drizzle, snake in SQL.

---

## Phase 1 — Schema & contracts

**Goal:** add the `summary` column for version titles; confirm contracts; no behavior yet.

### T1.1 — Add `summary` to `skill_versions`
- Edit `server/src/db/schema/skills.ts`: add `summary: text('summary')` (nullable) to `skillVersions`.
- Run `pnpm db:generate` (from `server/`). A new `00NN_*.sql` migration appears under `src/db/migrations/`. **Do not hand-edit** migrations.
- Verify the generated SQL only adds the column (no destructive diff). Commit the migration + snapshot.
- Apply with `pnpm db:migrate` against the dev DB.

### T1.2 — Row types
- In `server/src/db/rows.ts` add:
  - `export type SkillRow = typeof t.skills.$inferSelect;`
  - `export type SkillVersionRow = typeof t.skillVersions.$inferSelect;`

### T1.3 — Contract review (no change expected)
- Confirm `Skill` in `*/vendor/shared/contracts/knowledge.ts` matches the table. It does (`id,name,description,type,source,body,enabled,version,evidence_files?`).
- Add two NEW contracts to **both** vendored copies (server + client), in `knowledge.ts` near the Skills block:
  - `SkillVersion` = `{ skill_id: string; version: number; summary: string | null; body: string; created_at: string }`.
  - `SkillStats` = `{ skill_id: string; used_by: number; agents: { id: string; name: string }[]; pull_rate: number | null; accept_rate: number | null; findings_30d: number | null; findings_by_category: { category: string; count: number }[] | null }` (null fields are the honest placeholders).
- Export both `z.object` + `z.infer` types, matching the file's existing style.

**Acceptance:** `pnpm --filter @devdigest/api typecheck` and client `pnpm typecheck` pass; migration applies cleanly; `SkillRow`/`SkillVersionRow` importable.

---

## Phase 2 — Server: Skills CRUD module

**Goal:** full CRUD + versioning over `skills`/`skill_versions`, workspace-scoped, mirroring the agents module. New module `server/src/modules/skills/`.

### T2.1 — `repository.ts` (`SkillsRepository`)
Mirror `modules/agents/repository.ts`. Methods:
- `list(workspaceId): Promise<SkillRow[]>` — `eq(skills.workspaceId, …)`.
- `getById(workspaceId, id): Promise<SkillRow | undefined>`.
- `insert(values): Promise<SkillRow>` — insert skill at `version: 1`; then snapshot v1 into `skill_versions` (body + summary). Default `enabled` from caller.
- `update(workspaceId, id, patch): Promise<SkillRow | undefined>` — load existing; bump `version` **iff body changed** (use a `isBodyChange` helper, analogous to `isConfigChange`); on bump, write a new `skill_versions` row (`onConflictDoNothing`) with the new body + `patch.summary ?? null`. Toggling `enabled`/editing name/description/type does **not** bump version (matches agents, where only config bumps).
- `deleteById(workspaceId, id): Promise<boolean>` — cascade removes `skill_versions` + `agent_skills` links.
- `listVersions(skillId): Promise<SkillVersionRow[]>` — newest `version` first.
- `getVersion(skillId, version): Promise<SkillVersionRow | undefined>`.
- `usedBy(skillId): Promise<{ id: string; name: string }[]>` — join `agent_skills`→`agents` for the agents linking this skill (workspace implied via the skill).
- Re-export `SkillRow`, `SkillVersionRow` from `../../db/rows.js`.

### T2.2 — `helpers.ts` (pure)
- `toSkillDto(row: SkillRow): Skill` — snake_case mapping (`evidence_files: row.evidenceFiles ?? null`).
- `toSkillVersionDto(row: SkillVersionRow): SkillVersion`.
- `isBodyChange(existing, patch): boolean`.
- **Extraction helpers** (no I/O beyond the passed buffer):
  - `parseFrontmatter(md: string): { attrs: Record<string,string>; body: string }` — minimal `---`-fence parser: if the file starts with `---\n…\n---`, parse simple `key: value` lines (single-line values; ignore nested YAML); strip the fence from `body`. No new YAML dep.
  - `extractFromMarkdown(md: string): ExtractedSkill` — `{ name?, description?, type?, body }` from frontmatter (`name`, `description`, `type`) falling back to: name = first `# H1`; description = first paragraph; type = `'custom'`; body = full markdown (fence stripped).
  - `extractFromArchive(buf: Buffer): ExtractedSkill` — via `adm-zip`: enumerate entries; pick `SKILL.md` if present, else the first `*.md`; **ignore every other entry** (scripts, binaries, nested dirs). Throw a typed `BadRequestError('No markdown skill found in archive')` when none. Then run `extractFromMarkdown` on it.
  - `ExtractedSkill` type: `{ name: string | null; description: string | null; type: SkillType; body: string; source: 'extracted' }`.

### T2.3 — `service.ts` (`SkillsService`)
Constructor takes `Container`, builds `new SkillsRepository(container.db)`. Methods:
- `list / get / delete` → DTO mapping.
- `create(workspaceId, input)` — `input: { name; description; type; body; source?; enabled?; summary? }`. Defaults: `source='manual'`, `enabled=true`. Returns `Skill`.
- `update(workspaceId, id, patch)` — patch `{ name?; description?; type?; body?; enabled?; summary? }`.
- `listVersions / getVersion` (workspace-guarded: 404 if skill not in workspace).
- `restore(workspaceId, id, version)` — load that version's body; call `update(... { body, summary: 'Restored v{version}' })` so it becomes a new version (never mutate history). Return updated `Skill`.
- `stats(workspaceId, id): Promise<SkillStats>` — `used_by` = `agents.length`; `agents` from `repo.usedBy`; **placeholders**: `pull_rate/accept_rate/findings_30d = null`, `findings_by_category = null` (no finding→skill attribution exists; do NOT fabricate).
- `importPreview(file: { filename: string; buffer: Buffer }): ExtractedSkill` — dispatch on extension: `.zip` → `extractFromArchive`; `.md`/`.markdown`/other text → `extractFromMarkdown(buffer.toString('utf8'))`. **No persistence.**

### T2.4 — `routes.ts`
Fastify plugin (`withTypeProvider<ZodTypeProvider>`), `new SkillsService(app.container)`, `getContext` for workspace scoping, `IdParams` from `_shared/schemas.ts`, `NotFoundError`/`BadRequestError` from `platform/errors.ts`. Routes:

| Method | Path | Body/params | Handler |
|---|---|---|---|
| `GET` | `/skills` | — | `service.list(workspaceId)` |
| `GET` | `/skills/:id` | `IdParams` | `service.get`; 404 if missing |
| `POST` | `/skills` | `CreateSkillBody` | 201 + created `Skill` |
| `PUT` | `/skills/:id` | `IdParams` + `UpdateSkillBody` | `service.update`; 404 if missing |
| `DELETE` | `/skills/:id` | `IdParams` | `{ ok: true }`; 404 if missing |
| `GET` | `/skills/:id/versions` | `IdParams` | `service.listVersions`; 404 |
| `GET` | `/skills/:id/versions/:version` | `VersionParams` | `service.getVersion`; 404 |
| `POST` | `/skills/:id/restore/:version` | `VersionParams` | `service.restore`; 404 |
| `GET` | `/skills/:id/stats` | `IdParams` | `service.stats`; 404 |
| `POST` | `/skills/import/preview` | multipart file | `service.importPreview` → `ExtractedSkill` (no persist) |

- `CreateSkillBody = z.object({ name: z.string().min(1), description: z.string(), type: SkillType, body: z.string().min(1), source: SkillSource.optional(), enabled: z.boolean().optional(), summary: z.string().optional() })`.
- `UpdateSkillBody` = all of the above optional (at least one).
- `VersionParams = z.object({ id: z.string().uuid(), version: z.coerce.number().int().positive() })`.

### T2.5 — Multipart support for `/skills/import/preview`
- Add dep `@fastify/multipart` (server `package.json`). Register the plugin in the app bootstrap (`server/src/app.ts` or wherever plugins register — mirror existing `@fastify/cors`/`helmet` registration) with a sane file-size limit (e.g. 2 MB).
- Add dep `adm-zip` + `@types/adm-zip`.
- In the route, read the uploaded file via `req.file()` (await buffer). Validate presence; map missing file to `BadRequestError`.
- Constrain accepted extensions to `.md`, `.markdown`, `.txt`, `.zip`; reject others with `BadRequestError`.

### T2.6 — Wire module + container
- `server/src/modules/index.ts`: import `skills from './skills/routes.js'`; add `skills,` to the `modules` record.
- `server/src/platform/container.ts`: add `private _skillsRepo?: SkillsRepository;` + `get skillsRepo(): SkillsRepository { return (this._skillsRepo ??= new SkillsRepository(this.db)); }`. Import the repo at top.

**Acceptance:** server typecheck passes; `GET /skills` returns `[]` on a fresh DB; create→get→update(body)→listVersions shows 2 versions; restore adds a 3rd; delete cascades; `import/preview` with a `.md` and a `.zip` (containing `SKILL.md` + a dummy `.sh`) returns the extracted core and ignores the `.sh`.

---

## Phase 3 — Server: inject skills into the review run (keystone)

**Goal:** make linked+enabled skills actually reach the prompt; surface in trace.

### T3.1 — Load + filter linked skills in `run-executor.ts`
- In `RunExecutor` (the method that builds the `reviewPullRequest` input, ~`server/src/modules/reviews/run-executor.ts:195`), before the engine call:
  - `const linked = await this.container.agentsRepo.linkedSkills(agent.id);` (already ordered by `agent_skills.order` asc).
  - `const skillBodies = linked.filter((l) => l.skill.enabled).map((l) => l.skill.body);`
  - Pass `...(skillBodies.length ? { skills: skillBodies } : {})` into the `reviewPullRequest({ … })` call object (omit-when-empty contract, like `callers`/`repoMap`).
- Do **not** wrap skill bodies as untrusted — skills are deliberately instructions. Trust mitigation is import-disabled-by-default + manual vetting (already enforced in Phase 2).
- The trace's `prompt_assembly.skills` populates automatically via `outcome.assembly` (already persisted at `run-executor.ts:~265`). No trace code change for the success path.
- Leave the failure-path placeholder (`traceFromBuffer`, `skills: null`) unchanged.

### T3.2 — Log the skills block as a discrete step (optional polish)
- Emit a `runLog.info` like `Injected N enabled skill(s) into the prompt` when `skillBodies.length > 0`, so the run log shows the block was added (supports the "enabled skill visible in logs, disabled not" acceptance).

**Acceptance (unit test, see Phase 7):** an agent with 2 linked skills (1 enabled, 1 disabled) yields `reviewPullRequest` input `skills` = `[enabledBody]`, in link order; an agent with no enabled links omits `skills`; the resulting `assembly.skills` is non-null only when ≥1 enabled skill is linked.

---

## Phase 4 — Client: API hooks

**Goal:** typed hooks for all skill operations + agent-skill linking. New `client/src/lib/hooks/skills.ts`; extend `api.ts` for uploads.

### T4.1 — Upload helper in `api.ts`
- `apiFetch` currently forces `content-type: application/json` whenever `init.body != null`, which breaks `FormData` (browser must set the multipart boundary). Fix: skip the JSON content-type when `init.body instanceof FormData`.
- Add `api.upload = <T>(path: string, form: FormData) => apiFetch<T>(path, { method: 'POST', body: form })`.

### T4.2 — `lib/hooks/skills.ts`
React Query hooks (mirror `lib/hooks/agents.ts`):
- `useSkills()` → `GET /skills` (`queryKey: ['skills']`).
- `useSkill(id)` → `GET /skills/:id` (`['skill', id]`, `enabled: !!id`).
- `useCreateSkill()` → `POST /skills`; invalidate `['skills']`.
- `useUpdateSkill()` → `PUT /skills/:id`; invalidate `['skills']`, set `['skill', id]`, invalidate `['skill-versions', id]`.
- `useDeleteSkill()` → `DELETE /skills/:id`; invalidate `['skills']`, remove `['skill', id]`.
- `useSkillVersions(id)` → `GET /skills/:id/versions` (`['skill-versions', id]`).
- `useSkillVersion(id, version)` → `GET /skills/:id/versions/:version` (lazy; for Diff).
- `useRestoreSkillVersion()` → `POST /skills/:id/restore/:version`; invalidate skill + versions.
- `useSkillStats(id)` → `GET /skills/:id/stats` (`['skill-stats', id]`).
- `useImportSkillPreview()` → `api.upload('/skills/import/preview', form)` (mutation; no cache).

### T4.3 — Agent-skill hooks (for the agent Skills tab)
- `useAgentSkills(agentId)` → `GET /agents/:id/skills` (`['agent-skills', agentId]`).
- `useSetAgentSkills()` → `POST /agents/:id/skills` with `{ skill_ids }`; invalidate `['agent-skills', agentId]` + `['agent', agentId]` + `['agents']` (linked-count badge on cards).

**Acceptance:** hooks typecheck against contracts; no direct `fetch` outside `api.ts`.

---

## Phase 5 — Client: `/skills` page (list + tabbed editor)

**Goal:** master-detail Skills page matching the design. New route tree `client/src/app/skills/`.

### T5.1 — Routes
- `src/app/skills/page.tsx` — thin entry rendering `<SkillsView />` (no selection; right pane = "Select a skill" empty state from `skills.page.selectPrompt`).
- `src/app/skills/[id]/page.tsx` — `<SkillsView selectedId={id} />`; tab state in `?tab=` (`config|preview|evals|stats|versions`, default `preview`).
- Wrap in `AppShell` with crumb `[{ label: 'Skills Lab' }, { label: 'Skills', href: '/skills' }]`.

### T5.2 — `_components/SkillsListView/` (master-detail shell)
- Two-column flex like `agents/[id]/page.tsx` (left list ~360px scroll, right detail flex). Left = header (`Skills` + `Add Skill ▾` Dropdown: `Create from scratch` | `Import from file`) + search + `SkillCard` list. Right = `SkillEditor` or empty state.
- Selecting a card → `router.push('/skills/:id?tab=preview')`; keep active highlight.
- `Add Skill` → Create opens `CreateSkillModal`; Import opens `ImportSkillDrawer`.
- States: loading `Skeleton`, error `ErrorState` (`skills.page.loadError`), empty `EmptyState` (`skills.page.empty.*`).
- Files: `SkillsListView.tsx`, `styles.ts`, `constants.ts`, `helpers.ts` (`filterSkills`), `index.ts`.

### T5.3 — `_components/SkillCard/`
- Card mirrors `AgentCard`: icon, mono name, `Toggle` (enabled → `useUpdateSkill`), 1-line description, type `Badge` (color per type), source `Badge` (`skills.listItem.source.*` — Manual/Extracted/Community/Imported), footer stat line **`{n} agents`** only (real; pull/accept omitted — no data). Include `active` prop. Add `SkillCard.test.tsx`.

### T5.4 — `_components/SkillEditor/` (Tabs container)
- `Tabs` with `config|preview|evals|stats|versions` (labels via `skills` ns — add `editor.tabs.*` keys). Header: icon + name + type Badge + version Badge (`v{n}`) + disabled "Run on evals" Button (stub, tooltip "coming soon"). Body renders the active tab.

#### T5.4a — `ConfigTab`
- Form (mirror agent `ConfigTab`): `Name*` (`TextInput`), `Description` (`TextInput`, **hint** = directive-interface copy → add `skills.config.descriptionHint`), `Type` (`SelectInput` over `SkillType`), `Body` (`Textarea mono rows={14}`), `Enabled` (`Toggle`). When body is dirty, reveal an optional `Summary of change` `TextInput`. **Save** → `useUpdateSkill` with `{ name, description, type, body, enabled, summary? }`; success toast with new version. Reset local state on `skill.id` change (per agent `ConfigTab` pattern).

#### T5.4b — `PreviewTab`
- Heading `Preview` + sub "Rendered as the reviewing agent receives it." Render `<Markdown>{skill.body}</Markdown>` inside a `Card`. (i18n `skills` ns — add `preview.title/subtitle`.)

#### T5.4c — `EvalsTab` (stub)
- Empty mount-point: `EmptyState` "Evals arrive in a later lesson." No data calls.

#### T5.4d — `StatsTab`
- `useSkillStats(id)`. Four `MetricCard`s: **USED BY** = `used_by` agents (real); **PULL FREQ / ACCEPT RATE / FINDINGS (30D)** render a muted "no data yet" when the field is `null` (do not show fake %). Panel **Agents using this skill**: list from `stats.agents`, each row clickable → `/agents/:id?tab=skills` (label `Open`). **Findings by category**: if `findings_by_category` is null, render a placeholder card "no data yet" (skip `Donut`); wire `Donut` only if real data later exists.

#### T5.4e — `VersionsTab`
- `useSkillVersions(id)`. Heading `Version history` + `{n} versions` + reproducibility sub-copy. List newest-first: version badge `v{n}`, `summary` (or "—"), date, `Current` badge on the head. For non-current rows: **Diff** button (opens a modal: simple line-level diff of that version's body vs current — reuse `components/diff-viewer` utils if a line-diff helper exists, else a minimal LCS/line compare) and **Restore** (`useRestoreSkillVersion` → toast → invalidates). Add i18n keys under `skills.versions.*`.

### T5.5 — `_components/CreateSkillModal/`
- Modal like `CreateAgentModal`: Name, Description (with directive hint), Type, Body. Submit → `useCreateSkill` (`source: 'manual'`, `enabled: true`) → navigate to `/skills/:id?tab=config`.

### T5.6 — `_components/ImportSkillDrawer/`
- File picker (accept `.md,.markdown,.txt,.zip`). On select → `useImportSkillPreview` (FormData) → render extracted `{ name, description, type, body }` (Type editable `SelectInput`; Body read-only `Markdown`/`Textarea`). Untrusted notice (`skills.preview.untrustedNotice`). **Save** (only after preview) → `useCreateSkill` with `{ source: 'extracted', enabled: false, … }` → navigate to the new skill. Errors → `skills.drawer.importFailed`.

**Acceptance:** can create, edit (new version), toggle enabled, import a `.md` and a `.zip`, view Preview/Stats/Versions, diff + restore a version, all via the UI; lint/typecheck/tests pass.

---

## Phase 6 — Client: Agent editor "Skills" tab + nav

### T6.1 — Add Skills tab to Agent editor
- `client/src/app/agents/[id]/_components/AgentEditor/constants.ts`: add `{ key: 'skills', labelKey: 'editor.tabs.skills', icon: 'Sparkles' }` to `TABS`.
- `agents/[id]/page.tsx`: add `'skills'` to `VALID_TABS`.
- `AgentEditor.tsx`: render `SkillsTab` when `tab === 'skills'`, else `ConfigTab`.

### T6.2 — `_components/SkillsTab/`
- `useSkills()` (all workspace skills) + `useAgentSkills(agent.id)` (currently linked, ordered). Local ordered state seeded from linked + appended unlinked.
- Header: `{linked} of {total} enabled` (`agents.skills.enabledCount`) + filter `TextInput` (`agents.skills.filterPlaceholder`) + order hint (`agents.skills.orderHint`).
- Row: drag handle (☰), checkbox (linked?), mono name, type Badge. Checkbox toggles membership; drag reorders **linked** rows. Persist via `useSetAgentSkills({ agentId, skill_ids: orderedLinkedIds })` on change (debounced or on drop/toggle).
- Reorder: reuse an existing DnD lib if the repo already has one (grep `@dnd-kit`/`react-dnd`); otherwise native HTML5 `draggable` with an index swap. Keep it isolated in `helpers.ts`.
- Add `SkillsTab.test.tsx` (link/unlink/reorder persists the right `skill_ids`).

### T6.3 — Sidebar nav
- `client/src/vendor/ui/nav.ts`: add a `SKILLS LAB` group containing `{ key:'skills', label:'Skills', icon:'Sparkles', href:'/skills', gKey:'s' }` and move the existing `Agents` item into it. Keep `WORKSPACE` → `Pull Requests`. Do **not** add items without routes (Conventions, Eval Dashboard, Memory, etc.).
- Add the `g s` shortcut to `SHORTCUTS`.
- Update any nav snapshot/test expecting the old structure.

**Acceptance:** agent editor shows Config + Skills tabs; linking/reordering in the tab changes the agent's prompt on the next run (manual or Phase 7 test); sidebar shows Skills under SKILLS LAB; `g s` navigates.

---

## Phase 7 — Seed demo

**Goal:** the control experiment works out of the box.

### T7.1 — Seed skills
- New `server/src/db/seed-skills.ts` exporting skill bodies (markdown), mirroring `seed-prompts.ts` style. At least:
  - `pr-quality-rubric` (`type:'rubric'`, `source:'manual'`, enabled) — multi-section rubric (Correctness/Security/Tests/Scope) as in the design; **seed 5 `skill_versions`** with summaries ("Initial rubric" … "Tightened scope rule; cap at 5 high-signal findings") and ascending dates so the Versions tab matches the mock.
  - `test-coverage-rubric` (`type:'rubric'`/`custom`, enabled) — uncovered branches, missing corner cases, over-mocking, flaky patterns (for Test Quality Reviewer).
  - `api-contract-guard` (`type:'convention'`, enabled) — detect route signature / breaking changes (for API Contract Reviewer).
  - one with `source:'extracted'`, `enabled:false` to represent an import (e.g. `no-then-chains`).
- In `seed.ts`: idempotent insert (check by `name` within workspace, like agents). For `pr-quality-rubric`, also insert its 5 `skill_versions` rows (set the skill's `version` to 5).

### T7.2 — Seed agents
- Add to `seedAgents` in `seed.ts`: **Test Quality Reviewer** and **API Contract Reviewer** (prompts in `seed-prompts.ts`; optionally mirror to `docs/agent-prompts/*.md`). Keep idempotent insert.

### T7.3 — Seed links
- After both skills and agents are inserted, populate `agent_skills`: link `test-coverage-rubric` (+ maybe `pr-quality-rubric`) to Test Quality Reviewer; `api-contract-guard` (+ `pr-quality-rubric`) to API Contract Reviewer, with `order` set. Idempotent (skip if a link exists). Re-read ids by name within the workspace.

**Acceptance:** `./scripts/dev.sh --db-only` (migrate + seed) yields the skills + 2 agents with links; the Skills page and the agents' Skills tab render the seeded data; `pr-quality-rubric` shows 5 versions.

---

## Phase 8 — Tests, i18n, docs, insights

### T8.1 — Server tests (vitest)
- `modules/skills/*.test.ts`: repository (CRUD, version bump only on body change, restore adds version, cascade delete, `usedBy`); service (`importPreview` for md + zip, including "executable entry ignored" and "no markdown → BadRequestError"; `stats` placeholders are null); routes (status codes, workspace scoping → 404 cross-tenant).
- `modules/reviews/run-executor` test (or extend existing): linked+enabled skills passed to the engine in order; disabled/unlinked omitted; `assembly.skills` null when none. Inject a mock LLM/engine via `ContainerOverrides`.

### T8.2 — Client tests (RTL + vitest)
- `SkillCard` (toggle, badges), `ConfigTab` (save → version + summary field appears when body dirty), `VersionsTab` (diff opens, restore calls hook), `StatsTab` (real USED BY + "no data yet" placeholders, agents list links), `ImportSkillDrawer` (preview → save with `source:'extracted', enabled:false`), agent `SkillsTab` (link/unlink/reorder → correct `skill_ids`).
- Mirror any new vendored-contract test fixtures in **both** copies if used (client `INSIGHTS.md`).

### T8.3 — i18n
- Extend `client/messages/en/skills.json`: `editor.tabs.*`, `config.descriptionHint`, `preview.title/subtitle`, `stats.*` (labels + "no data yet"), `versions.*` (history, diff, restore, current), `evals.stub`.
- `agents.json`: `editor.tabs.skills` already exists; confirm `skills.*` strings cover the tab. Keep keys in sync.

### T8.4 — Docs & insights
- Brief `server/README.md` / `client/README.md` route additions if those files enumerate routes.
- After the session, run `/engineering-insights` (or let the Stop hook) to append lessons to touched modules' `INSIGHTS.md` (server + client). Per `feedback_engineering_insights_timing`: only after real code changes.

**Acceptance:** `pnpm test` green in server + client; `pnpm typecheck` green in both; `pnpm lint` clean.

---

## Dependency & sequencing notes

- **Phase order:** 1 → 2 → 3 can proceed; 4 depends on 1–2; 5–6 depend on 4; 7 depends on 2 (and ideally 6 for links); 8 throughout.
- **Parallelizable:** Phase 5 tabs (T5.4a–e) are independent components once T5.4 shell + Phase 4 hooks exist; Phase 6 is independent of Phase 5 once hooks land.
- **New deps:** `@fastify/multipart`, `adm-zip`, `@types/adm-zip` (server only).
- **Migrations:** exactly one (`summary` column). Generate via `pnpm db:generate`; never hand-edit.
- **Contract changes:** `SkillVersion`, `SkillStats` added to BOTH `server/` and `client/` vendored `knowledge.ts`.

## Out of scope (explicit)
URL import, community catalog, real pull/accept/findings metrics, finding→skill
attribution, the eval engine and "Run on evals", and all sidebar items without
existing routes (Conventions, Eval Dashboard, Memory, Multi-Agent Review, Agent
Performance, CI Runs, Onboarding Tour, Project Context).

## Definition of done (feature-level)
1. A skill can be created, edited (new immutable version), enabled/disabled, imported (md + zip), and deleted in the UI.
2. An agent's Skills tab links/unlinks/reorders skills; the order + enabled-gate is honored.
3. A review run injects only linked **and** globally-enabled skill bodies, in order, into the prompt; the run trace shows a distinct `Skills / rules` block with added tokens; a disabled skill produces no block.
4. Preview renders the body as the agent receives it; Stats shows real "Used by N agents" + agents list (placeholders elsewhere); Versions lists history with working Diff + Restore.
5. Seed provides the two new agents with linked skills and a 5-version `pr-quality-rubric`.
6. Typecheck, lint, and tests pass in server and client.
