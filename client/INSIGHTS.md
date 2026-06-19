# client — Insights

Accumulated, hard-won lessons for `@devdigest/web` — the things that bit us and
shouldn't bite us twice. Referenced from `client/CLAUDE.md` ("read when…").

> Append-only. Add to the right section; never rewrite or delete existing
> entries. Each entry must be concrete and actionable "cold" — useful to someone
> who has NOT seen this session. Test: "if it's obvious to anyone reading the
> code, don't write it." Written by the `engineering-insights` skill.

## What Works
<!-- Approaches/solutions that worked. e.g. "X via Y in src/foo.ts:42 because …" -->

## What Doesn't Work
<!-- Dead ends & antipatterns. The most valuable & most-skipped section. -->
- The client has its own vendored copy of shared contracts at `client/src/vendor/shared/contracts/` that is **not auto-synced** with `server/src/vendor/shared/contracts/`. Adding a field to the server copy alone passes server typecheck but breaks client typecheck. Always mirror changes to both copies (`trace.ts` and `platform.ts` were both affected in the cost feature).

## Codebase Patterns
<!-- Conventions & architectural decisions, with the "why". -->

## Tool & Library Notes
<!-- Dependency quirks, version gotchas, env/config oddities. -->
- `NEXT_PUBLIC_*` env vars are inlined into the bundle at **start time** (`next dev` / `next build`), not at request time. Changing a `NEXT_PUBLIC_*` value in `.env` requires a dev-server restart to take effect — a page refresh is not enough.

## Recurring Errors & Fixes
<!-- Error signature → root cause → fix. -->
- **`TS2322: Type 'number | null | undefined' is not assignable to type 'number | null'` in `RunHistory.test.tsx`** — root cause: `RunSummary` gained a new `nullable()` field (not `nullish()`), so the `Partial<RunSummary>` factory in the test fixture no longer satisfies the full type. Fix: add the new field with an explicit `null` default inside the `run()` factory function (`RunHistory.test.tsx:30`).

## Session Notes
<!-- Dated wrap-ups, newest first: ### YYYY-MM-DD — <one-line summary> -->
### 2026-06-19 — NEXT_PUBLIC_COST_FORMAT_DIGITS: env var requires dev-server restart, not just page refresh
### 2026-06-18 — Added COST column to PR list, tok·cost badge in RunHistory, COST stat in TraceBody

## Open Questions
<!-- Unresolved threads for the next session. -->
