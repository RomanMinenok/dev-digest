# client — Insights

Accumulated, hard-won lessons for `@devdigest/web` — the things that bit us and
shouldn't bite us twice. Referenced from `client/CLAUDE.md` ("read when…").

> Append-only. Add to the right section; never rewrite or delete existing
> entries. Each entry must be concrete and actionable "cold" — useful to someone
> who has NOT seen this session. Test: "if it's obvious to anyone reading the
> code, don't write it." Written by the `engineering-insights` skill.

## What Works
<!-- Approaches/solutions that worked. e.g. "X via Y in src/foo.ts:42 because …" -->
- **Verifying a new page when you can't click through it: `pnpm build` + a static `t()`-key audit.** `pnpm typecheck` does NOT catch RSC/client-boundary errors or missing-i18n-key crashes; `next build` catches the former (compiles + generates every route) but still NOT the latter — a missing `next-intl` `t("a.b")` key throws only at *render*, so it slips past both typecheck and build. The cheap guard is a node script that flattens `messages/en/<ns>.json` into dotted paths and checks every `t("…")` literal in the route's files resolves (treat `t(\`prefix.${x}\`)` template keys by their static prefix — confirm a child exists). Used to validate the whole `/skills` tree after an agent built it without runtime checks.

## What Doesn't Work
<!-- Dead ends & antipatterns. The most valuable & most-skipped section. -->
- **`apiFetch` (`src/lib/api.ts`) force-sets `content-type: application/json` on any non-null body, which breaks `FormData` uploads** — the browser must set `multipart/form-data; boundary=…` itself, and an explicit JSON content-type overrides it, so the server can't parse the parts. Fix: skip the JSON content-type when `init.body instanceof FormData` (do NOT set content-type at all for FormData). The skill-import upload (`api.upload` → `POST /skills/import/preview`) depends on this.
- The client has its own vendored copy of shared contracts at `client/src/vendor/shared/contracts/` that is **not auto-synced** with `server/src/vendor/shared/contracts/`. Adding a field to the server copy alone passes server typecheck but breaks client typecheck. Always mirror changes to both copies (`trace.ts` and `platform.ts` were both affected in the cost feature).

## Codebase Patterns
<!-- Conventions & architectural decisions, with the "why". -->
- Components shared across a **route subtree** (parent + its `[param]` children) belong in the parent's `_components/` folder, not in `src/components/`. Example: `SeverityChips` is used by both `pulls/_components/PRRow` and `pulls/[number]/_components/RunHistory`, so it lives at `pulls/_components/SeverityChips/`. Only promote to `src/components/` when used across unrelated routes.
- **Lazy hover-fetch pattern** (React Query): use `enabled: hovered && !!id && hasData` to defer the network call until the user actually hovers over the trigger. Pair with `staleTime: 30_000` to avoid refetching on repeated hovers within 30 s. Implemented in `pulls/_components/PRRow/PRRow.tsx` for the findings popover — avoids N requests on initial list render.
- **Mismatched hover zones between a block wrapper and an inline-flex child cause popover to never show** — `PRRow` tracked `chipsHovered` on a full-width block `<div>` around `SeverityChips` to gate the lazy fetch. `SeverityChips` tracked its own `hovered` on the smaller `inline-flex` chips area to show the popover. The fetch fired from the large zone; the popover showed from the small zone — they rarely overlapped in practice. Fix: fetch eagerly (gated by `hasFindings`, not by hover) so findings are already loaded when the user hovers the chips. See `PRRow.tsx` — `enabled: !!pr.id && hasFindings` with no hover gate.
- **Moving hover state inside a component breaks callers that depended on external hover** — `RunSeverityChips` used `enabled: hovered` for lazy React Query fetch, where `hovered` came from its own `useState`. When the hover zone (+ popover) moved inside `SeverityChips`, `RunSeverityChips` lost the hover signal and the fetch never fired. Fix: move the data fetch one level up to `RunHistory` (one `useQuery` per PR page, keyed by `prId`) and pass findings down as props. React Query deduplication still guarantees a single network request even if multiple child components share the same `queryKey`. See `RunHistory.tsx:findingsByRunId`.
- **Absolutely-positioned popovers inside table rows are clipped by `overflow: hidden`** — `FindingsPopover` used `position: absolute` relative to `SeverityChips`'s wrapper, which is inside a PR list row. The row (or a grid ancestor) has `overflow: hidden`, so the popover was cut off. Fix: use `createPortal(card, document.body)` + `position: fixed` with coordinates from `ref.current.getBoundingClientRect()` captured on mouseenter. The portal escapes all clipping ancestors. See `FindingsPopover.tsx` + `SeverityChips.tsx:handleMouseEnter`.
- **`pointerEvents: none` on hover popovers** — when a popover is absolutely positioned over its trigger and the popover itself doesn't need to be interactive, set `pointerEvents: none`. Without it, moving the mouse from the trigger div into the popover card fires `mouseLeave` on the trigger and immediately hides the popover, causing flicker. See `FindingsPopover.tsx:44`. If the popover needs to be interactive (links, buttons), extend the hover zone to cover both trigger + popover instead.
- **Filter badge counts must come from the raw (unfiltered) array, not the filtered result** — in `FindingsPanel`, `severityCounts` is computed from `findings` (the full prop), not from `shown` (the filtered output). If it used `shown`, clicking a chip would mutate the counts on all other chips to reflect only the filtered subset, making them jump around. Computing from the source array keeps chip labels stable regardless of the active filter. See `FindingsPanel.tsx:32-39`.
- **Dynamic `Icon` component lookup requires two casts** — `Icon[name as keyof typeof Icon] as React.ComponentType<{ size?: number }>`. The first cast (`keyof typeof Icon`) satisfies the TS index signature; the second (`as React.ComponentType<...>`) is needed because the namespace type is a union of all icon shapes and TS cannot infer JSX callability from it. Without both casts you get either an index error or "JSX element type does not have any construct or call signatures". See `FindingsPanel.tsx:71`.
- **Course lesson scaffolding: check `helpers.ts` and `messages/en/` before wiring a new route** — When adding a route that corresponds to a future lesson (conventions, eval-dashboard, etc.), `client/src/components/app-shell/helpers.ts:activeKeyFor` likely already returns the correct sidebar key for that path, and a skeleton i18n file may already exist under `client/messages/en/`. Found both pre-wired for `/conventions` before adding any code. Creating duplicates or overwriting them causes subtle drift, so always read those two locations first.

## Tool & Library Notes
<!-- Dependency quirks, version gotchas, env/config oddities. -->
- `NEXT_PUBLIC_*` env vars are inlined into the bundle at **start time** (`next dev` / `next build`), not at request time. Changing a `NEXT_PUBLIC_*` value in `.env` requires a dev-server restart to take effect — a page refresh is not enough.

## Recurring Errors & Fixes
<!-- Error signature → root cause → fix. -->
- **`textDecoration: underline` has no effect on SVG icons inside `display: inline-flex`** — root cause: `text-decoration` only draws under text nodes, not SVG children. Fix: use `borderBottom: "1px solid/dashed/dotted <color>"` + `paddingBottom: 2` on the `inline-flex` span instead — border applies to the element box and covers both icon and number. See `SeverityChips.tsx` interactive chip style.
- **`TS2322: Type 'number | null | undefined' is not assignable to type 'number | null'` in `RunHistory.test.tsx`** — root cause: `RunSummary` gained a new `nullable()` field (not `nullish()`), so the `Partial<RunSummary>` factory in the test fixture no longer satisfies the full type. Fix: add the new field with an explicit `null` default inside the `run()` factory function (`RunHistory.test.tsx:30`).

## Session Notes
<!-- Dated wrap-ups, newest first: ### YYYY-MM-DD — <one-line summary> -->
### 2026-06-28 — Added Conventions screen (/conventions): nav item in SKILLS LAB sidebar, ConventionsView + ConventionCard with mock data, accept/reject state, confidence bars, i18n; helpers.ts and conventions.json were already scaffolded from course lesson structure.
### 2026-06-28 — Resolved the pre-existing RunHistory "No QueryClient set" failure (5 tests, see Open Questions 2026-06-21 entry) by wrapping the test render helper in a fresh QueryClientProvider, matching AgentCard.test.tsx. Client now 38/38 green.
### 2026-06-21 — Skills feature client: /skills page + tabbed editor, agent Skills tab (native HTML5 DnD), SKILLS LAB nav group, FormData upload support in api.ts
### 2026-06-20 — Added severity filter chips to FindingsPanel toolbar (activeSeverity state + visibleFindings extension)
### 2026-06-19 — Fix popover clipping: createPortal + position:fixed to escape overflow:hidden table row
### 2026-06-19 — Fix chip underlines: borderBottom instead of textDecoration to cover SVG icons
### 2026-06-19 — Fix PR list popover: eager fetch replaces lazy hover-gated fetch to avoid block-vs-inline hover zone mismatch
### 2026-06-19 — Unified findings popover into SeverityChips; fixed broken lazy-fetch by hoisting query to RunHistory
### 2026-06-19 — Extended severity chips hover popover + underlines to the agent runs timeline (RunHistory)
### 2026-06-19 — Added findings hover popover with lazy React Query fetch and interactive underlines on severity chips
### 2026-06-19 — Added FINDINGS column (severity chips) to PR list and run timeline
### 2026-06-19 — NEXT_PUBLIC_COST_FORMAT_DIGITS: env var requires dev-server restart, not just page refresh
### 2026-06-18 — Added COST column to PR list, tok·cost badge in RunHistory, COST stat in TraceBody

## Open Questions
<!-- Unresolved threads for the next session. -->
- `RunHistory.test.tsx` fails with "No QueryClient set" (5 tests) on `main` independent of the skills work — `RunHistory` calls `useQuery` directly (queryKey `["reviews", prId]`) but the test renders it without a `QueryClientProvider` wrapper. Pre-existing since the 2026-06-19 query-hoist change. Fix is a one-line provider wrap in the test; left untouched as out-of-scope.
