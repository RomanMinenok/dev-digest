# e2e — Insights

Accumulated, hard-won lessons for `@devdigest/e2e` — the things that bit us and
shouldn't bite us twice. Referenced from `e2e/CLAUDE.md` ("read when…").

> Append-only. Add to the right section; never rewrite or delete existing
> entries. Each entry must be concrete and actionable "cold" — useful to someone
> who has NOT seen this session. Test: "if it's obvious to anyone reading the
> code, don't write it." Written by the `engineering-insights` skill.

## What Works
<!-- Approaches/solutions that worked. e.g. "X via Y in src/foo.ts:42 because …" -->
- **To click a specific button in a flow spec, use `["find","role","button","click","--name","Label"]`, not `["find","text","Label","click"]`.** In agent-browser 0.29.1 the `find text "X" click` form fails ("Command failed") when "X" is not a unique exact text node — it matched multiple nodes for the `Tabs` tab buttons (Versions/Stats) and for the PR-row title, killing the step. Role + `--name` targets the single accessible element reliably. Verified in `specs/08-skills.flow.json` (tab switches) and `specs/09-agent-skills.flow.json`.
- **A tab label that collides with a sidebar nav item (e.g. "Skills") is still unambiguous by role**: the `Tabs` primitive (`client/.../vendor/ui/kit/Tabs.tsx`) renders each tab as a `<button>` (role=button), while `NavItem` renders a Next `<Link>` → `<a>` (role=link). So `find role button click --name "Skills"` hits the editor tab, never the sidebar link. Used in `09-agent-skills`.

## What Doesn't Work
<!-- Dead ends & antipatterns. The most valuable & most-skipped section. -->

## Codebase Patterns
<!-- Conventions & architectural decisions, with the "why". -->

## Tool & Library Notes
<!-- Dependency quirks, version gotchas, env/config oddities. -->

## Recurring Errors & Fixes
<!-- Error signature → root cause → fix. -->

## Session Notes
<!-- Dated wrap-ups, newest first: ### YYYY-MM-DD — <one-line summary> -->
### 2026-06-21 — Added 08-skills + 09-agent-skills flows (Skills Lab + agent Skills tab); switched tab clicks to role-based find after `find text click` broke on agent-browser 0.29.1

## Open Questions
<!-- Unresolved threads for the next session. -->
- `specs/04-pr-findings.flow.json` and `05-pr-diff.flow.json` fail on `["find","text","Add rate limiting to public API endpoints","click"]` (the PR #482 row) under agent-browser 0.29.1 — same `find text click` non-unique-node issue as above, NOT a regression from the skills feature. Fix is to switch that PR-row click to a role-based locator (e.g. `find role link click --name …`) like the skills flows now do. Left untouched as out-of-scope for the skills work.
