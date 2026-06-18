# client — @devdigest/web

Next.js 15 (App Router) + Mantine. The studio UI.

## Commands
`pnpm dev` (:3000) · `pnpm build` · `pnpm test` (vitest) · `pnpm typecheck`

## Layout
- `src/app/` = routes (`/onboarding`, `/repos/[repoId]/pulls/[number]`, `/agents`, `/settings/[section]`)
- `_components/` folders are route-local components (co-located, not shared)
- `src/lib/api.ts` = single REST + SSE client to the server
- `src/lib/` also holds providers, hooks, theme, types

## Conventions (non-default)
- Talk to the server **only** through `src/lib/api.ts` — do not scatter fetch calls.
- Live review log is consumed via SSE, not polling.
- i18n messages live in `src/messages/` (keep keys in sync when adding copy).

## Gotchas
- Server runs on :3001; the client expects it up (see root `./scripts/dev.sh`).
- Route-local `_components/` are private to their route — promote to `src/components/` only when reused.

## Do not touch
- `.next/` — build output.

## Read when
- UI route map → read `client/README.md`
- a past bug / lesson in this package → read `client/INSIGHTS.md`
- a design decision or open spec → read `client/specs/`
- deeper design / component notes → read `client/docs/`
