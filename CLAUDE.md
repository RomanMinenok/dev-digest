# DevDigest — root map

Local-first AI PR reviewer **and** a teaching course. 5 standalone packages
sharing code through tsconfig path aliases — **not** a pnpm workspace.

## Where things live
- `server/` — `@devdigest/api` · Fastify + Drizzle/Postgres (pgvector) · :3001 → see `server/CLAUDE.md`
- `client/` — `@devdigest/web` · Next.js 15 + Mantine · :3000 → see `client/CLAUDE.md`
- `reviewer-core/` — `@devdigest/reviewer-core` · pure review engine, no I/O → see `reviewer-core/CLAUDE.md`
- `e2e/` — `@devdigest/e2e` · deterministic agent-browser flows → see `e2e/CLAUDE.md`
- `@devdigest/shared` — Zod contracts + adapter interfaces, vendored at `server/src/vendor/shared/` (not a real package)

## Commands
- `./scripts/dev.sh` — full stack from zero (docker → migrate → seed → server + client)
- `./scripts/dev.sh --db-only` — just Postgres + migrate + seed
- `./scripts/e2e.sh` — hermetic e2e on alternate ports

## Conventions (non-default)
- Cross-package imports resolve to **TS source** via path aliases. `reviewer-core` and `shared` never emit JS — their `build` is a typecheck.
- Only Postgres runs in Docker; API + web run on the host.

## Gotchas
- Many `server/src/db/schema/*` and `server/src/vendor/shared/contracts/*` are **ahead of implementation** (course lessons L01–L08): the schema/contract exists, the feature may not.
- A `*_SONNET.md` file in the root is a draft from another model — not authoritative.

## Session context (learnings loop)
- **Before** working in a module, read its `INSIGHTS.md` and treat it as
  high-confidence guidance (a `UserPromptSubmit` hook nudges this).
- **After** a substantive session, the `engineering-insights` skill writes the
  wrap-up to the touched module's `INSIGHTS.md` — append-only, dedup-checked. A
  `Stop` hook fires it automatically; `/engineering-insights` runs it on demand.

## Read when
- onboarding / how the modules talk → read `ONBOARDING.md`, then `README.md`
- working inside a package → read that package's `CLAUDE.md` (auto-loaded by location)
