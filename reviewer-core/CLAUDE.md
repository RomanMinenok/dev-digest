# reviewer-core — @devdigest/reviewer-core

The **pure** review engine. Shared by the studio server and the CI runner.

## Commands
`pnpm test` (vitest) · `pnpm typecheck` · `pnpm build` (= typecheck only — never emits JS)

## Layout
- `src/review/run.ts` = entry point `reviewPullRequest()`: assemble → single-pass / map-reduce → reduce → grounding
- `src/prompt.ts` = prompt assembly + prompt-injection hardening (`wrapUntrusted`)
- `src/grounding.ts` = citation gate (drops findings whose line refs aren't in the diff)
- `src/llm/openrouter.ts` = the one OpenAI-compatible structured provider
- `src/output/to-review.ts` = grounded Review → GitHub review payload

## Conventions (non-default)
- **NO I/O.** No DB, GitHub, fs, or network — the only side effect is the **injected** `LLMProvider`.
- The caller resolves skill bodies / memory / specs to **strings**; this package receives resolved text, never slugs.
- Score is derived from findings that **survived grounding**, not the model's self-reported number.
- `auto` strategy picks map-reduce only when the diff is both large **and** multi-file.

## Gotchas
- Consumed as TS source via path alias (`tsx`/`vitest`/`@vercel/ncc`) — keep it importable without a build step.
- Cancellation is via an injected `checkCancelled()` that throws; the engine stays error-type agnostic.

## Read when
- the review pipeline diagram → read `reviewer-core/README.md`
- a past bug / lesson in this package → read `reviewer-core/INSIGHTS.md`
- a design decision or open spec → read `reviewer-core/specs/`
- deeper engine notes → read `reviewer-core/docs/`
