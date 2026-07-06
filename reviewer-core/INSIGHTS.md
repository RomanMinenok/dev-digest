# reviewer-core — Insights

Accumulated, hard-won lessons for `@devdigest/reviewer-core` — the things that
bit us and shouldn't bite us twice. Referenced from `reviewer-core/CLAUDE.md`.

> Append-only. Add to the right section; never rewrite or delete existing
> entries. Each entry must be concrete and actionable "cold" — useful to someone
> who has NOT seen this session. Test: "if it's obvious to anyone reading the
> code, don't write it." Written by the `engineering-insights` skill.

## What Works
<!-- Approaches/solutions that worked. e.g. "X via Y in src/foo.ts:42 because …" -->

## What Doesn't Work
<!-- Dead ends & antipatterns. The most valuable & most-skipped section. -->

## Codebase Patterns
<!-- Conventions & architectural decisions, with the "why". -->
- **Adding a new prompt section (omit-when-empty, byte-identical baseline).** Three steps: (1) add the optional field to `ReviewInput` in `src/review/run.ts` and thread it through the single `promptParts` object (`src/review/run.ts:130`) — that object feeds BOTH the whole-diff assembly AND the per-chunk loop, so threading it once covers both paths; (2) in `src/prompt.ts` build the section only when the field is present and push it into `userSections` only when truthy (so an absent field changes nothing); (3) add a matching `.nullish()` field to `PromptAssembly` in the vendored `trace.ts` — in BOTH `server/` and `client/` copies (no auto-sync) — or the assembly object won't typecheck. `test/prompt.test.ts` guards the no-section path as byte-identical to the old prompt — run it after. Worked example: the `intent` slot (`## Declared intent` = `wrapUntrusted('intent', …)` followed by a TRUSTED, unwrapped scope rule) in `src/prompt.ts`.

## Tool & Library Notes
<!-- Dependency quirks, version gotchas, env/config oddities. -->

## Recurring Errors & Fixes
<!-- Error signature → root cause → fix. -->

## Session Notes
<!-- Dated wrap-ups, newest first: ### YYYY-MM-DD — <one-line summary> -->
### 2026-07-02 — Added the Declared-intent prompt slot (wrapUntrusted intent + trusted one-signal-finding scope rule) threaded via promptParts + PromptAssembly.intent; omit-when-empty keeps the no-intent prompt byte-identical (23 tests green)

## Open Questions
<!-- Unresolved threads for the next session. -->
