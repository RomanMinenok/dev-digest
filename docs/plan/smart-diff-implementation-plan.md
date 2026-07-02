# Smart Diff — Technical Implementation Plan

> Audience: engineers/agents executing the work. Assumes familiarity with the
> repo conventions in root `CLAUDE.md`, `server/CLAUDE.md`, `client/CLAUDE.md`.
> Read `server/INSIGHTS.md` + `client/INSIGHTS.md` before touching a module.
>
> Source spec: `docs/specs/smart-diff.md`.
> Design reference (mockup screenshot): `docs/specs/assets/smart-diff-mockup.png`.

## 0. Context & current state

Smart Diff groups a PR's changed files into three buckets — **core / wiring /
boilerplate** — via pure regex classification (zero LLM calls), and overlays
existing review findings (`file:line`) onto those files. **No new LLM call**:
Smart Diff is a deterministic composition of two already-existing data
sources.

### What already exists and must be reused (do NOT recreate)

| Asset | Location | State |
|---|---|---|
| `GET /pulls/:id` → `prFiles` (path, additions, deletions, patch) | `server/src/modules/pulls/routes.ts:227-319` | Implemented. Source of truth for the file list; falls back to persisted `t.prFiles` offline. |
| `GET /pulls/:id/reviews` → findings (`file`, `start_line`, `end_line`, `severity`) | `server/src/modules/reviews/service.ts:160` `reviewsForPull(workspaceId, prId)` | Implemented. Returns `ReviewDto[]`, each with `findings: ReviewDtoFinding[]`. |
| `SmartDiff` zod contract (`SmartDiffRole`, `SmartDiffFile`, `SmartDiffGroup`, `SmartDiff`) | `server/src/vendor/shared/contracts/brief.ts` **and** identical mirror in `client/src/vendor/shared/contracts/brief.ts` | Already defined, verified in sync (`diff` = no output). **No contract change needed** for this pass. |
| `IdParams` (`z.object({ id: z.string().uuid() })`) | `server/src/modules/_shared/schemas.ts` | Reuse for route params. |
| `resolvePrAndRepo` helper | `server/src/modules/pulls/routes.ts:325` (closure inside `pullsRoutes`) | Reused pattern for PR+repo lookup; used today by `/pulls/:id/comments`. |
| `usePrReviews(prId)` hook pattern | `client/src/lib/hooks/reviews.ts:51-57` | Template for the new `useSmartDiff(prId)` hook. |
| Tab switching (`?tab=`, `setParam` → `router.replace`) | `client/src/app/repos/[repoId]/pulls/[number]/page.tsx` | Existing convention — no hard reload, reused for finding navigation (target tab is the existing `diff` tab, not a new one — see Decision 8). |
| `FindingCard` `focused` / `defaultExpanded` props | `client/.../_components/FindingCard/FindingCard.tsx:28-29`, `data-finding-id` at line 55 | Already does what's needed for auto-expand/highlight/scroll target — no new props required on `FindingCard` itself. |
| 60-second session-window pattern (multi-agent "latest review run") | `server/src/modules/pulls/status.ts` / `routes.ts` (PR-list cost/severity rollup) | Reused for "findings from the last review" in this feature (see decision log). |
| `DiffTab.tsx` (65 lines) | `client/.../_components/DiffTab/DiffTab.tsx` | Props `{ prId, filesCount, files, canComment? }`. Renders `<SectionLabel icon="Code" right={...}>` toolbar (lines 45-61, `right` slot currently holds a conditional "Show/Hide comments" button) + `<DiffViewer files={files} commenting={...} />` (line 62). **This is where the Smart/Original order toggle is added** — see Decision 8. |
| `PrDetailHeader.tsx` (123 lines) | `client/.../_components/PrDetailHeader/PrDetailHeader.tsx:111-120` | `Tabs` with exactly 3 entries (`overview`, `findings`, `diff`) — confirmed no 4th tab is added for Smart Diff. |
| `SeverityBadge` + severity tokens | `client/src/vendor/ui/primitives/Badge.tsx:52-88`, `client/src/vendor/ui/primitives/tokens.ts:3,7-14` | `CRITICAL→"Critical"`, `WARNING→"Warning"`, `SUGGESTION→"Suggestion"`, `INFO→"Info"` (Title Case, no "Blocker"). Reused as-is (Decision 9) — no label changes. |
| `SEV_COLOR` map | `client/.../_components/FindingCard/constants.ts:4-9` | Same 4 severity keys → CSS vars (`var(--crit)`, `var(--warn)`, `var(--sugg)`, `var(--info)`) + `SEV_COLOR_FALLBACK`. Reuse for the left-edge stripe color, don't duplicate. |
| `FileCard.tsx` (per-file collapse) | `client/src/components/diff-viewer/FileCard/FileCard.tsx` | Already implements collapse state (`[open,setOpen]`, default open when `additions+deletions <= AUTO_EXPAND_MAX_LINES`) + chevron header. Pattern to mirror (not directly reuse, since it doesn't group by role or render a severity stripe) for the new Smart Diff file-row component. |

### Project engineering rules to honor (non-negotiable)
- Onion layering: `routes.ts` (Presentation) → `service.ts` (Application). No
  `repository.ts` added in this pass (see Decision 1) — the one `prFiles`
  query stays inline in `service.ts`, matching the module's current (pre-existing,
  non-canonical) style rather than introducing a disproportionate refactor.
- Modules depend on shared interfaces; cross-module reuse of `ReviewService`
  is done by instantiating it with the same `container`, not by reaching into
  `reviews/repository.ts` directly.
- DTO fields are `snake_case` (match contracts); Drizzle columns are camelCase.
- Client talks to the server only through `src/lib/api.ts` / hooks under
  `src/lib/hooks/`.
- Route-local components live in `_components/`, co-located, not promoted to
  `src/components/` unless reused elsewhere.
- Vendored `@devdigest/shared` copies (server + client) must stay in sync —
  not TypeScript-checked, verify manually if either is ever touched.

---

## Decision log (confirmed with user before implementation)

1. **Extract `server/src/modules/pulls/service.ts`** — **yes**. New
   `PullsService` class (constructor takes `container`, mirrors
   `ReviewService`'s shape).
   **(2026-07-02 revised)** `repository.ts` **was** added after an
   architecture review flagged `pulls/service.ts` as the only `service.ts`
   in the codebase doing direct `container.db`/Drizzle queries instead of
   going through a repository (every other module with a service —
   `reviews`, `agents`, `conventions`, `intent`, `repo-intel`, `repos`,
   `skills` — has one). `PullsRepository` (`pulls/repository.ts`) now owns
   `findPr(workspaceId, prId)` / `listPrFiles(prId)`, mirroring
   `ReviewRepository`'s `constructor(private db: Db)` shape;
   `PullsService.smartDiff` calls it instead of querying `t.pullRequests` /
   `t.prFiles` inline. `assembleSmartDiff` (the pure composition function)
   is unaffected.
2. **"Findings from the last review"** = all `ReviewDto`s within the
   **60-second session window** of the most recent `created_at` (matches the
   existing PR-list cost/severity rollup pattern), not just the single newest
   `ReviewDto`. Flatten findings from all reviews in that window together.
3. **`finding_lines`** = **`start_line` only** per finding (not the full
   `start_line..end_line` range). One entry per finding.
4. **`split_suggestion` heuristic** (not specified by the spec, accepted
   default):
   - `total_lines = sum(additions + deletions)` across all `prFiles`.
   - `too_big = total_lines > 400`.
   - `proposed_splits`: only when `too_big`; one entry per non-empty role
     (`{name: 'Core changes', files: [...]}`, `{name: 'Wiring changes', ...}`,
     `{name: 'Boilerplate changes', ...}`), reusing the already-computed
     classification. `[]` when not `too_big`.
5. **Tab/finding navigation** uses the existing `setParam` → `router.replace`
   convention (no new history entry per click), for consistency with the
   rest of the page's tab-switching — not `router.push` as the spec's prose
   literally suggests.
6. **Test scope**: add lightweight unit tests for `PullsService.smartDiff`
   (session-window selection, classification wiring, split_suggestion logic)
   and for `SmartDiffViewer`'s cross-reference helper, in addition to the
   spec-mandated `classifier.test.ts`. Not full route/component integration
   coverage.
7. **Client Phase C was blocked pending the screenshot — now unblocked.**
   Screenshot reviewed; see Decisions 8-10 below for the resulting
   architecture changes. Coding still requires final go-ahead (see end of
   document).
8. **Smart Diff is a "Smart order / Original order" toggle inside the
   existing `diff` ("Files changed") tab — NOT a new top-level tab.**
   `PrDetailHeader` has exactly 3 tabs with no room for a 4th (confirmed
   from the actual component). The toggle button pair lives in `DiffTab.tsx`'s
   existing `SectionLabel` `right` toolbar slot (currently holds a
   conditional "Show/Hide comments" button — the two live side by side).
   Selecting "Smart order" renders the new `SmartDiffViewer` in place of the
   existing `DiffViewer`; "Original order" (default) renders `DiffViewer`
   unchanged. Toggle state is a URL param (e.g. `?order=smart|original`) via
   the existing `setParam`/`router.replace` convention, so it's shareable
   and doesn't hard-reload.
9. **`pseudocode_summary` ("What this does" bubble in the screenshot) is
   omitted in this pass.** It has zero backend data source today — no
   route, service, or DB column produces it, and generating it would
   require a new LLM call, which directly contradicts the spec's core
   principle ("на самому кроці Smart Diff нового виклику моделі немає").
   The contract field is `nullish()`, so omitting it is contract-safe.
   `SmartDiffFile` rows render without the sparkle "What this does" line in
   v1. Flagged as a future increment if/when a summary-producing source
   exists (e.g. piggybacking on an existing Structured Reviewer pass).
10. **Severity badge labels reuse the existing `SeverityBadge` component
    as-is** (`Critical`/`Warning`/`Suggestion`/`Info`, Title Case) —
    the screenshot's lowercase `blocker`/`warning`/`suggestion` wording is
    illustrative, not a literal spec. No changes to `tokens.ts` or
    `Badge.tsx`. The left-edge stripe color reuses `SEV_COLOR` from
    `FindingCard/constants.ts` (same 4-key map), not a new color set.
11. **(2026-07-02, post-launch fix) The left-edge severity stripe covers the
    finding's full `start_line..end_line` range, not just `start_line`; the
    clickable badge renders once, at `start_line` only.** The initial pass
    matched `line === finding.start_line` exactly (literal reading of
    Decision 3's `finding_lines` shape), which only highlighted the first
    line of a multi-line finding and — because the match ran per rendered
    diff line — would have put a badge on every matched line if the range
    match had been added without the `start_line`-only badge guard.
    `SmartDiffViewer/helpers.ts`'s `findingForLine` now matches
    `line >= f.start_line && line <= f.end_line` (inclusive; `f.end_line`
    comes from the already-fetched `FindingRecord`, not from
    `SmartDiffFile.finding_lines`); `DiffLine` in `SmartDiffViewer.tsx`
    additionally gates the badge on `lineNo === finding.start_line`. No
    server/contract change — `finding_lines` isn't used for this matching at
    all (only for the collapsed-row indicator dot).
12. **(2026-07-02, post-launch fix) `DiffLine` must cross-reference findings
    using `ln.newNo` only, never `ln.newNo ?? ln.oldNo`.** `finding.start_line`/
    `end_line` are always new-file line numbers, but `parsePatch` only sets
    `oldNo` (not `newNo`) on deleted lines — so the `??` fallback silently fed
    old-file coordinates into a new-file-anchored comparison. Whenever a
    deleted line's old-line number numerically coincided with an unrelated
    finding's new-line range, that deleted line got a false-positive severity
    stripe and a duplicate badge (user-visible as "more warning badges than
    findings" on PR #23 / `NewTimeAttackButton.tsx`). Fix: `DiffLine` now
    computes `displayNo = ln.newNo ?? ln.oldNo` for the visible line-number
    column only, and matches/badges strictly on `ln.newNo`. See
    `client/INSIGHTS.md` Recurring Errors & Fixes for the full trace.

### Known contract gap (documented, not fixed)
`SmartDiffFile` (`path, pseudocode_summary?, additions, deletions,
finding_lines: number[]`) does **not** carry severity, finding `id`, or
`end_line` per line. The client cannot render a "colored stripe by severity"
or a "clickable severity badge" from `finding_lines` alone. **Workaround**:
`SmartDiffViewer` cross-references each rendered diff line against the
already-fetched `usePrReviews(prId)` findings (`file`, `start_line`,
`end_line`, `severity`, `id`) by matching `file === path && start_line <=
line <= end_line` (Decision 11 — range match, updated from the original
start_line-only match in Decision 3/first pass) to color the stripe across
the finding's whole span, then separately gates the clickable badge to
`line === start_line` so it renders once per finding, not once per line.
`file.finding_lines` (the server contract field) isn't consulted for this at
all — only for the collapsed-row indicator dot. The vendored contract itself
is not changed in this pass.

---

## Phase A — Classifier (pure, zero I/O, no open questions)

1. **`server/src/modules/pulls/classifier-patterns.ts`** (new)
   - `BOILERPLATE_PATTERNS: RegExp[]` — lockfiles (`pnpm-lock.yaml`,
     `package-lock.json`, `yarn.lock`), `dist/`/`build/` paths,
     `__snapshots__/`, `*.snap`, migration files (`*_migration.sql`,
     `db/migrations/*`), `*.generated.ts`.
   - `WIRING_PATTERNS: RegExp[]` — `index.ts`/`index.tsx` (any depth),
     `routes.ts`, config files (`*.config.ts`, `tsconfig*.json`,
     `.eslintrc*`, `vite.config.*`), schema files (`schema.ts`,
     `db/schema/*`), `container.ts`, `app.ts`, `server.ts`.
   - Comment documenting evaluation order: boilerplate checked first (a
     migration `.sql` could otherwise match a "schema" wiring pattern).

2. **`server/src/modules/pulls/classifier.ts`** (new)
   - `export function classifyFile(path: string): SmartDiffRole` — import
     `SmartDiffRole` from `@devdigest/shared`.
   - Boilerplate check → wiring check → default `'core'`. No I/O.

3. **`server/src/modules/pulls/classifier.test.ts`** (new)
   - 15 cases (5 per bucket), per spec examples:
     - boilerplate: `pnpm-lock.yaml`, `yarn.lock`, `dist/index.js`,
       `0001_migration.sql`, `__snapshots__/x.snap`
     - wiring: `src/index.ts`, `src/db/schema/repos.ts`, `vite.config.ts`,
       `tsconfig.json`, `src/modules/pulls/routes.ts`
     - core: `src/modules/reviews/service.ts`, `src/modules/pulls/classifier.ts`,
       `src/components/Button.tsx`, `src/lib/utils.ts`,
       `src/modules/reviews/helpers.ts`
   - Vitest `describe`/`it`, plain unit test (no `.it.` suffix — no DB/Docker
     dependency).

4. **`server/package.json`** — add
   `"verify:l03": "vitest run src/modules/pulls/classifier.test.ts"`.

**Acceptance:** `pnpm verify:l03` passes, 15/15 green.

---

## Phase B — `GET /pulls/:id/smart-diff`

1. **`server/src/modules/pulls/service.ts`** (new)
   - `export class PullsService { constructor(private container: Container) {} async smartDiff(workspaceId: string, prId: string): Promise<SmartDiff> { ... } }`
   - Steps inside `smartDiff`:
     1. Resolve PR + repo (reuse/move `resolvePrAndRepo` logic here, or
        duplicate the minimal lookup — prefer moving it to avoid drift,
        confirm `routes.ts` closures still compile after the move).
     2. Fetch `prFiles` for the PR via direct `container.db.select().from(t.prFiles).where(eq(t.prFiles.prId, pr.id))` (same query shape as the existing offline fallback at `routes.ts:288`).
     3. Fetch reviews via `new ReviewService(this.container).reviewsForPull(workspaceId, prId)`.
     4. Apply the 60-second session window (Decision 2): find max
        `created_at` among returned reviews, keep only those within 60s,
        flatten `.findings` from the kept reviews into one list.
     5. Build a `Map<path, number[]>` of `finding_lines` per file: for each
        kept finding, push `start_line` (Decision 3) into the array keyed by
        `finding.file`.
     6. For each `prFile`, call `classifyFile(prFile.path)` to get its role;
        build `SmartDiffFile { path, additions, deletions, finding_lines: findingLinesMap.get(path) ?? [] }` (`pseudocode_summary` omitted — no LLM call in this feature).
     7. Group files by role into `SmartDiffGroup[]` (`core`, `wiring`,
        `boilerplate` — include a group only if it has files, or always
        include all three with possibly-empty `files`; follow whatever the
        zod schema requires — check `SmartDiffGroup`/`SmartDiff` for
        optionality before deciding, default to always-three-groups for
        client-side rendering simplicity).
     8. Compute `split_suggestion` per Decision 4 using the already-computed
        per-file `additions+deletions` and role groupings.
     9. Return the assembled `SmartDiff` object.

2. **`server/src/modules/pulls/routes.ts`**
   - Instantiate `const pullsService = new PullsService(container);` near
     the top of `pullsRoutes`.
   - Register:
     ```ts
     app.get('/pulls/:id/smart-diff', { schema: { params: IdParams } }, async (req): Promise<SmartDiff> => {
       const { workspaceId } = await getContext(container, req);
       return pullsService.smartDiff(workspaceId, req.params.id);
     });
     ```
   - Place near the other `/pulls/:id/*` sub-routes (e.g. next to
     `/pulls/:id/comments`).

3. **`server/src/modules/pulls/service.test.ts`** (new, per Decision 6)
   - Unit tests for `PullsService.smartDiff` with a mocked/stubbed container
     (in-memory fixtures for `prFiles` and `reviewsForPull` results, no real
     DB): verify session-window filtering excludes reviews outside 60s,
     verify classification grouping matches `classifyFile` output, verify
     `split_suggestion.too_big` flips at the 400-line threshold and
     `proposed_splits` omits empty roles.

**Acceptance:** `pnpm typecheck` clean in `server/`; new unit tests green;
manual smoke test via `curl localhost:3001/pulls/:id/smart-diff` against a
seeded PR that already has a completed review run.

---

## Phase C — Client: Smart order toggle in `DiffTab`

Unblocked after screenshot review (Decisions 8-10). Screenshot reference:
`#482 Add rate limiting to public API endpoints` mockup — toolbar with
"Smart order"/"Original order" buttons, `REVIEWER-ORDERED DIFF` header,
three role sections (Core logic / Wiring / Boilerplate) each with a
one-line subtitle and file count, collapsible file rows with a colored
left-edge stripe + severity badge on flagged lines.

1. **`client/src/lib/hooks/reviews.ts`** — add `useSmartDiff(prId)`:
   ```ts
   export function useSmartDiff(prId: string | null | undefined) {
     return useQuery({
       queryKey: ["smart-diff", prId],
       queryFn: () => api.get<SmartDiff>(`/pulls/${prId}/smart-diff`),
       enabled: !!prId,
     });
   }
   ```
   `SmartDiff` type imported from `@devdigest/shared` (client vendor copy).

2. **`client/.../_components/DiffTab/DiffTab.tsx`**
   - Add local/URL-backed toggle state: `order` param via
     `useSearchParams()` + `setParam("order", "smart" | "original")` →
     `router.replace` (Decision 8), default `"original"` when absent (no
     behavior change for existing users/links).
   - In the `SectionLabel`'s `right` slot (lines 45-61), add a
     `Smart order` / `Original order` two-button toggle, laid out alongside
     the existing conditional "Show/Hide comments" button (don't remove
     that button — it only makes sense in "Original order" mode, since
     comments anchor to raw diff lines; hide it when `order === "smart"`).
   - Call `useSmartDiff(prId)` (gated: `enabled: order === "smart" && !!prId`,
     lazy — unlike the earlier plan's eager-fetch assumption, since this view
     is now opt-in via toggle, not a default tab render).
   - Render branch: `order === "smart" ? <SmartDiffViewer data={smartDiff} isLoading={smartDiffLoading} findings={...} onFindingClick={...} /> : <DiffViewer files={files} commenting={commenting} />`.
   - `findings` prop: fetch via the page's existing findings data source (
     whatever `FindingsTab`/`page.tsx` already uses — likely `usePrReviews`
     — thread it down to `DiffTab` as a new prop from `page.tsx`, since
     `DiffTab` doesn't currently receive findings).

3. **`client/.../_components/SmartDiffViewer/`** (new folder, co-located
   under the PR detail route like `DiffTab`/`FileCard`)
   - `SmartDiffViewer.tsx` — props `{ data: SmartDiff | undefined, isLoading: boolean, files: PrFile[], findings: FindingRecord[], repoFullName?: string | null, headSha?: string | null, onFindingClick: (findingId: string) => void }`.
     `files` (already fetched by the page via `usePullDetail`, and already
     passed into `DiffTab`) is required — `SmartDiffFile` from the server
     carries `path`/`additions`/`deletions`/`finding_lines` only, **no
     `patch`**, so rendering the actual diff content requires cross-
     referencing `SmartDiffFile.path` against `files[].patch` client-side.
   - Renders three role sections in fixed order `core → wiring →
     boilerplate` (client-side reorder — contract doesn't guarantee array
     order), each with:
     - A section header: colored square icon (blue/orange/gray — new,
       role-specific, not existing `SEV_COLOR`), role title ("Core logic" /
       "Wiring" / "Boilerplate"), a fixed one-line subtitle per role ("The
       substance of the change — review closely" / "Hooks the core into the
       app" / "Generated / mechanical — skim"), file count.
     - `boilerplate` section collapsed by default (local `useState` per
       section, default `role === 'boilerplate' ? false : true`).
   - **Each file row is individually collapsible and expands to the actual
     diff content** (not just a static summary row) — mirrors `FileCard`'s
     collapse pattern (chevron header, own `[open,setOpen]`, default open
     when `additions + deletions <= AUTO_EXPAND_MAX_LINES`, same constant
     `FileCard` uses) but is a **new** component (not a direct reuse of
     `FileCard`, which doesn't group by role or support the per-line
     severity stripe/badge). Collapsed header shows path, +/− counts, and
     (only if `finding_lines.length > 0`) a small indicator dot.
   - When open: `parsePatch(file.patch)` (reused from
     `components/diff-viewer/helpers.ts`) → render each line reusing
     `diff-viewer`'s `Line` type + styles (`s.hunk`, `s.lineNo`, `s.lineText`,
     `lineRowFor`, `lineSignFor`, `AUTO_EXPAND_MAX_LINES` — all already
     exported). `CodeLine` itself is too comment-thread-coupled to reuse
     directly; build a small local line renderer instead. "No diff
     available" fallback text when `patch` is empty/missing, matching
     `FileCard`.
   - No "What this does" / sparkle summary line in v1 (Decision 9 —
     `pseudocode_summary` omitted).
   - For each line number in a file's `finding_lines`, cross-reference
     against the `findings` prop (contract-gap workaround, `file === path
     && line === finding.start_line`, consistent with Decision 3) to find
     severity + finding `id`; render a left-edge colored stripe on **that
     specific rendered line** (reuse `SEV_COLOR` from
     `FindingCard/constants.ts`, Decision 10) and an inline clickable
     `SeverityBadge` at the end of that line (reuse from `@devdigest/ui` /
     `Badge.tsx`, Decision 10 — plain `Critical`/`Warning`/`Suggestion`/`Info`
     labels, no relabeling) that calls `onFindingClick(finding.id)`. Badges
     render inline per-line (matching the mockup), **not** bunched in the
     file header — an earlier pass got this wrong (aggregated badges in the
     collapsed header, no way to see the diff at all) and was corrected
     after screenshot comparison against the mockup.
   - `helpers.ts` — pure, unit-testable cross-reference function
     (`file+line` → matching finding), per Decision 6.
   - `constants.ts` — role display order, titles, subtitles, and the
     role-badge colors (new — not severity colors).
   - `styles.ts` — inline style object matching existing `_components/*`
     convention.

4. **Finding click → existing `diff` tab's comment/findings surface, or
   `findings` tab?** The screenshot doesn't show a click-through target (no
   second screenshot of the destination state) — the original spec text
   says clicking a badge navigates to "Review Runs → Findings" tab with
   `?findingId=`. Keep that part of the original plan: `onFindingClick`
   calls `setParam("tab", "findings")` + `setParam("findingId", findingId)`
   (still `replace`, Decision 5), independent of the new `order` param (both
   coexist in the URL, e.g. `?tab=findings&findingId=xxx` after the click —
   the `order=smart` param persists on the `diff` tab in case the user goes
   back).

5. **`client/.../_components/FindingsTab/FindingsTab.tsx`** (and whatever
   intermediate component renders `FindingCard` — trace this chain first,
   it was not fully resolved during planning)
   - Read `findingId` from the URL (`useSearchParams()` or threaded prop),
     pass `focused={f.id === findingId}` / `defaultExpanded={f.id === findingId}`
     to the matching `FindingCard`.
   - Add a scroll-into-view effect targeting `[data-finding-id="..."]`
     (already set by `FindingCard.tsx:55`) so the highlighted card is
     visible after tab-switch.

6. **Component test** for `SmartDiffViewer`'s cross-reference helper
   (`helpers.ts`), per Decision 6 — pure function, no rendering required.

**Acceptance:** `pnpm build` + `pnpm typecheck` clean in `client/`; manual
click-through: toggling "Smart order" on the Files changed tab renders role
groups from a real PR (boilerplate starts collapsed), toggling back to
"Original order" restores the current `DiffViewer` behavior unchanged,
clicking a severity badge switches to the Findings tab with the correct
card expanded and scrolled into view, no hard reload (verify via network
tab / URL bar not flashing).

---

## Execution order

1. Phase A — fully unblocked, start first.
2. Phase B — unblocked (all decisions confirmed above), start after Phase A
   or in parallel.
3. Phase C — unblocked (screenshot reviewed, Decisions 8-10 resolved),
   start after Phase B (needs the `/pulls/:id/smart-diff` route live).

## Open follow-ups (not blocking, tracked for later)
- `resolvePrAndRepo` extraction from `routes.ts` closure into `service.ts` —
  confirm no behavior change for existing `/pulls/:id/comments` callers
  after the move.
- `SmartDiffGroup` empty-role handling (always three groups vs. omit empty)
  — decide during Phase B implementation by checking the zod schema's
  strictness; not a product decision, just an implementation detail.
- i18n key for the new "Smart Diff" tab label — verify existing tab-label
  sourcing convention before Phase C.
