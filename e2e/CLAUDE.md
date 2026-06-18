# e2e — @devdigest/e2e

Deterministic browser e2e via agent-browser. Driven by JSON flow specs.

## Commands
`pnpm test` (`tsx run.ts`) · `pnpm e2e:hermetic` (`../scripts/e2e.sh`) · `pnpm typecheck`

## Layout
- `run.ts` = runner entry
- `specs/*.flow.json` = the actual test flows (boot, pulls, agents, findings, diff, onboarding, settings)
- `lib/` = runner helpers
- `agent-browser.json` = agent-browser config

## Conventions (non-default)
- Tests are **data, not code**: add a flow by writing a `specs/NN-name.flow.json`, not a TS test.
- `pnpm e2e:hermetic` runs against a freshly-seeded stack on **alternate ports** — never touches your dev DB.

## Gotchas
- Flows are numbered (`01-`…`07-`) and run in order; keep the prefix when adding one.
- `specs/` here holds **executable flows**, not design specs (unlike other packages' `specs/`).

## Read when
- how the runner + flow format work → read `e2e/README.md`
- a past bug / lesson in this package → read `e2e/INSIGHTS.md`
- existing test flows → read `e2e/specs/*.flow.json`
- deeper testing notes → read `e2e/docs/`
