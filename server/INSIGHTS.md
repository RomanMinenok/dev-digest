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
- Spreading `{ usage: { include: true } }` into the OpenAI SDK `chat.completions.create()` call DOES reach OpenRouter — the SDK passes untyped extra body fields through without stripping them. Confirmed: `res.usage.cost` is populated for both plain completions and structured output (`response_format: json_schema`) calls. The cast `(res.usage as { cost?: number })?.cost` is correct.

## What Doesn't Work
<!-- Dead ends & antipatterns. The most valuable & most-skipped section. -->
- **New `FEATURE_MODELS` entries must default to `openrouter`, not `openai`** — the `conventions` entry shipped with `defaultProvider: 'openai'`/`defaultModel: 'gpt-5.4'`, which silently demands `OPENAI_API_KEY` at runtime even when the workspace has only `OPENROUTER_API_KEY` configured. Every other feature (`onboarding`, etc.) defaults to `openrouter`. Check `FEATURE_MODELS` in both vendor copies of `platform.ts` (`server/src/vendor/shared/contracts/platform.ts` and `client/src/vendor/shared/contracts/platform.ts`) when adding a new feature — the default propagates directly to `resolveFeatureModel` → `container.llm(provider)`.
- "Take the single newest completed `agent_run` for PR-list cost" is wrong when multiple agents run together — you get only one agent's cost. The correct definition is **sum of the latest run per agent** (newest `ran_at` per `agent_id`, then sum `cost_usd`). Implemented in `modules/pulls/routes.ts` via a `seenAgentPerPr` Set + accumulator loop over rows sorted `ran_at DESC`.
- `run-executor.ts` was calling `priceBook.estimate()` unconditionally, discarding `outcome.costUsd` that the engine already computed from the OpenRouter API. The engine (`reviewPullRequest` in `reviewer-core`) returns `costUsd` on the `ReviewOutcome` — always prefer it; fall back to estimate only when null: `outcome.costUsd ?? priceBook.estimate(agent.model, tokensIn, tokensOut)` (fixed in `modules/reviews/run-executor.ts:214`).
- **(2026-06-19 correction of above)** "Sum of latest run per agent" is also wrong — it mixes agents from different review sessions (e.g. Security from yesterday + General from today). The correct approach is a **60-second session window**: find the newest `ran_at` for the PR, then sum `cost_usd` of all completed runs within 60 s of it. Agents launched together by one "Run Review" click start within milliseconds; 60 s safely covers any DB round-trip lag. Implemented in `modules/pulls/routes.ts` (two-pass: find `latestRanAtByPr`, then filter + sum).

## Codebase Patterns
<!-- Conventions & architectural decisions, with the "why". -->
- `ReviewRepository` in `modules/reviews/repository.ts` is a class wrapper around the function-level repos in `repository/run.repo.ts`, `repository/review.repo.ts`, etc. When adding a field to `completeAgentRun`, you must update **both** the underlying function signature in `run.repo.ts` AND the class method signature in `repository.ts` — a mismatch causes a TS error at the `run-executor.ts` call site, not at the definition, which is confusing.
- **Linked skills reach a review run ONLY through `run-executor.ts`, not the engine or the agents module.** The engine (`reviewPullRequest`) and `assemblePrompt` already accept a resolved `skills: string[]`, but until `run-executor.ts` loads them, linking a skill to an agent has zero effect on a review. The executor loads them via its constructor-injected agents repo (`this.agents.linkedSkills(agent.id)` = `container.agentsRepo`, already ordered by `agent_skills.order`), filters to `skill.enabled`, and passes `...(skillBodies.length ? { skills } : {})` (omit-when-empty, like `callers`/`repoMap`). The in-prompt gate is therefore **linked AND `enabled`**, enforced at that filter — not in the engine. Skill bodies are passed as trusted instructions (NOT `wrapUntrusted`); the trust mitigation is import-disabled-by-default + manual vetting.
- `agent_runs` has **no direct FK to `findings`**. The join chain for per-run severity counts is `findings.review_id → reviews.id → reviews.run_id`. To query severity breakdown per run: `JOIN reviews ON findings.review_id = reviews.id WHERE reviews.run_id IN (...)` grouped by `reviews.run_id, findings.severity`. There is no shortcut via `agent_runs` — the link only exists through `reviews`. See `modules/reviews/repository/run.repo.ts:listRunsForPull` and `modules/pulls/routes.ts` for the implemented pattern.
- **Anti-hallucination gate for LLM extraction**: after `completeStructured`, verify each candidate by taking `evidence_snippet.split('\n')[0].trim()` and checking the referenced file on disk literally `includes()` that string. Drop the candidate if the file is missing or the first line is absent. This kills hallucinated `file:line` references without fuzzy matching or embeddings. Implemented in `modules/conventions/extractor.ts`; re-use this pattern for any future LLM feature that returns evidence paths.
- **`repoIntel.getConventionSamples()` returns `[]` when the index is disabled or not yet built** (the `RepoIntel` degraded contract). LLM features that need sample source files must have a fallback or the scan silently operates on zero files. Convention extractor handles this with `fallbackWalk` in `modules/conventions/helpers.ts` — a simple BFS over the clone filtered to `.ts/.tsx/.js/.jsx`, excluding `node_modules`/`dist`/`.git`/migrations/test files. Apply the same pattern for future features that consume `getConventionSamples` or similar `RepoIntel` methods.

## Tool & Library Notes

<!-- Dependency quirks, version gotchas, env/config oddities. -->
- **`tsx watch` does not reliably hot-reload changes inside `src/vendor/`** — module-level constants computed at startup (e.g. `DEFAULTS` in `modules/settings/feature-models.ts`, computed from `FEATURE_MODELS`) stay stale after editing a vendor file until the server process is fully restarted. A page refresh is not enough. If a runtime behavior doesn't reflect a vendor-file change, restart the server manually (`Ctrl+C` → `pnpm dev`).
- `@fastify/multipart` must be the **v10** major for Fastify v5 (v9 targets Fastify v4 and silently fails to register types). Register it once in `app.ts` next to cors/helmet with a `limits.fileSize` cap (2 MB for skill import). Gotcha: calling `req.file()` on a request that is NOT `multipart/form-data` (or has no file part) throws the plugin's own error that surfaces as **406**, not a clean 400. Wrap `await req.file()` in try/catch and throw `BadRequestError` so a missing/wrong upload is a 400 (see `modules/skills/routes.ts`, the `/skills/import/preview` handler).
- `BadRequestError` (400) did not exist in `platform/errors.ts` before the skills module — it was added there. Reuse it; don't reinvent a 400 in a module.

## Recurring Errors & Fixes
<!-- Error signature → root cause → fix. -->
- **Cost shown is ~2× actual OpenRouter cost** → pricing table in `server/src/adapters/llm/pricing.ts` has wrong values. Root cause: the table is the fallback when `usage.cost` from the API is absent, so any table error shows up directly. Fix: verify each model's prices against `openrouter.ai/models` before adding. Example: `deepseek/deepseek-v4-flash` was `{ in: 0.14, out: 0.28 }` (2× too high); corrected to `{ in: 0.07, out: 0.14 }`.

## Session Notes
<!-- Dated wrap-ups, newest first: ### YYYY-MM-DD — <one-line summary> -->
### 2026-06-29 — Diagnosed stale DEFAULTS after vendor file edit: tsx watch misses vendor/ changes, server restart required
### 2026-06-29 — Fix conventions feature model default: openai→openrouter/deepseek-v4-flash in both vendor platform.ts copies
### 2026-06-29 — Conventions extractor: pure LLM extraction module with anti-hallucination gate + replaceAll repository + fallbackWalk for degraded repo-intel
### 2026-06-21 — Skills feature: CRUD module + zip/md import (adm-zip, @fastify/multipart v10) + run-executor keystone (inject linked+enabled skill bodies) + seed
### 2026-06-19 — Severity breakdown per run/PR via findings→reviews→run_id join chain (no DB migration needed)
### 2026-06-19 — Fix run-executor: use outcome.costUsd (real API cost) instead of always re-estimating
### 2026-06-19 — Fix deepseek-v4-flash pricing: table had 2× wrong prices, corrected to $0.07/$0.14 per 1M
### 2026-06-19 — Fix PR-list cost: 60-second session window replaces per-agent latest
### 2026-06-19 — Fix PR-list cost: sum latest-per-agent runs, not single newest run
### 2026-06-18 — Added cost_usd to agent_runs + PR list + run history (migration 0010)

## Open Questions
<!-- Unresolved threads for the next session. -->
- `cost_usd` was in `agent_runs` from `0000_init.sql` but was deliberately dropped in `0009_complex_runaways.sql` ("cleanup before home tasks"). If cost reappears in migration 0010, check whether there is a matching cleanup migration that also needs reverting/updating.
- **(2026-06-19 — RESOLVED)** `usage.cost` from OpenRouter IS reaching the app — the spread works and the SDK passes it through. The real bug was `run-executor.ts` discarding `outcome.costUsd` entirely (see What Doesn't Work).
