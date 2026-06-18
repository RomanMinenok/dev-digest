# server — @devdigest/api

Fastify API + Drizzle/Postgres. Entry: `src/server.ts`.

## Commands
`pnpm dev` (tsx watch) · `pnpm test` (vitest) · `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:seed`

## Layout
- `modules/<feature>/` = `routes.ts` + `service.ts` + `repository.ts`
- `platform/container.ts` = DI composition root (lazy adapters, test overrides)
- `adapters/` implement interfaces from `@devdigest/shared`
- `modules/reviews/run-executor.ts` orchestrates a review run (diff → enrich → engine → persist → SSE)
- `modules/repo-intel/` = symbol/dep-graph indexer behind the `RepoIntel` facade

## Conventions (non-default)
- Modules depend on **shared interfaces**, never concrete adapters — inject mocks via `ContainerOverrides`.
- Cross-entity repositories (agents, reviews) live on the container, not inside another module's folder.
- `RepoIntel` degraded contract: array methods return `[]` when degraded; object methods carry inline `degraded?`.

## Gotchas
- Call `container.invalidateSecretCaches()` after persisting a new API key / PAT.
- Embeddings gated by `EMBEDDINGS_ENABLED` — when off the OpenAI client is never built (zero requests).
- repo-intel has a **double gate**: global `REPO_INTEL_ENABLED` + per-agent toggle.

## Do not touch
- `src/db/migrations/*` — generated; change `src/db/schema/*.ts` then `pnpm db:generate`.
- `src/vendor/shared/*` — vendored copy of `@devdigest/shared`.

## Read when
- API route contracts → read `server/README.md`
- repo-intel internals → read `src/modules/repo-intel/README.md`
- a past bug / lesson in this package → read `server/INSIGHTS.md`
- a design decision or open spec → read `server/specs/`
- deeper architecture notes → read `server/docs/`
