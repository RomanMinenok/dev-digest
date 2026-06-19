# server — Insights

Accumulated, hard-won lessons for `@devdigest/api` — the things that bit us and
shouldn't bite us twice. Referenced from `server/CLAUDE.md` ("read when…").

> Append-only. Add to the right section; never rewrite or delete existing
> entries. Each entry must be concrete and actionable "cold" — useful to someone
> who has NOT seen this session. Test: "if it's obvious to anyone reading the
> code, don't write it." Written by the `engineering-insights` skill.

## What Works
<!-- Approaches/solutions that worked. e.g. "X via Y in src/foo.ts:42 because …" -->
- Computing PR-list cost with a separate `SELECT cost_usd FROM agent_runs WHERE status='done' ORDER BY ran_at DESC` + JS grouping (same pattern as score in `modules/pulls/routes.ts:119-130`) — cheap enough for a small PR list, keeps the query readable, and avoids a complex JOIN.

## What Doesn't Work
<!-- Dead ends & antipatterns. The most valuable & most-skipped section. -->
- "Take the single newest completed `agent_run` for PR-list cost" is wrong when multiple agents run together — you get only one agent's cost. The correct definition is **sum of the latest run per agent** (newest `ran_at` per `agent_id`, then sum `cost_usd`). Implemented in `modules/pulls/routes.ts` via a `seenAgentPerPr` Set + accumulator loop over rows sorted `ran_at DESC`.
- **(2026-06-19 correction of above)** "Sum of latest run per agent" is also wrong — it mixes agents from different review sessions (e.g. Security from yesterday + General from today). The correct approach is a **60-second session window**: find the newest `ran_at` for the PR, then sum `cost_usd` of all completed runs within 60 s of it. Agents launched together by one "Run Review" click start within milliseconds; 60 s safely covers any DB round-trip lag. Implemented in `modules/pulls/routes.ts` (two-pass: find `latestRanAtByPr`, then filter + sum).

## Codebase Patterns
<!-- Conventions & architectural decisions, with the "why". -->
- `ReviewRepository` in `modules/reviews/repository.ts` is a class wrapper around the function-level repos in `repository/run.repo.ts`, `repository/review.repo.ts`, etc. When adding a field to `completeAgentRun`, you must update **both** the underlying function signature in `run.repo.ts` AND the class method signature in `repository.ts` — a mismatch causes a TS error at the `run-executor.ts` call site, not at the definition, which is confusing.

## Tool & Library Notes
<!-- Dependency quirks, version gotchas, env/config oddities. -->

## Recurring Errors & Fixes
<!-- Error signature → root cause → fix. -->

## Session Notes
<!-- Dated wrap-ups, newest first: ### YYYY-MM-DD — <one-line summary> -->
### 2026-06-19 — Fix PR-list cost: 60-second session window replaces per-agent latest
### 2026-06-19 — Fix PR-list cost: sum latest-per-agent runs, not single newest run
### 2026-06-18 — Added cost_usd to agent_runs + PR list + run history (migration 0010)

## Open Questions
<!-- Unresolved threads for the next session. -->
- `cost_usd` was in `agent_runs` from `0000_init.sql` but was deliberately dropped in `0009_complex_runaways.sql` ("cleanup before home tasks"). If cost reappears in migration 0010, check whether there is a matching cleanup migration that also needs reverting/updating.
