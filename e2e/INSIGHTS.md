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
- **Running `npm test` against your already-running dev stack yields false failures that look exactly like app regressions.** On 2026-07-28, flows `02`/`04`/`05` all failed on `agent-browser wait --text "Add rate limiting to public API endpoints"` against the dev stack on :3000/:3001 — not a UI bug: the seeded PR #482 row (`server/src/db/seed.ts:109`) simply wasn't in that database, because your dev DB is whatever you last left it as, not a fresh `db:migrate && db:seed`. The same commit scored 9/9 under `./scripts/e2e.sh`. Reproduce hermetically **before** hunting the app — the hermetic runner brings up an ephemeral Postgres on alternate ports (5433/3101/3100) and is explicitly designed to run alongside a live dev stack without touching it.

## Codebase Patterns
<!-- Conventions & architectural decisions, with the "why". -->

## Tool & Library Notes
<!-- Dependency quirks, version gotchas, env/config oddities. -->
- **(2026-07-29) `./scripts/e2e.sh` runs `next dev`; `e2e-web.yml` runs `pnpm build` + `pnpm start`. The hermetic runner is NOT a CI equivalent, despite its own header claiming it "mirrors" the workflow.** `scripts/e2e.sh:148` spawns `next dev -p $WEB_PORT`, so a green local 9/9 can still be 8/9 on CI — production-only behaviour (RSC payload inlining, build-time `NEXT_PUBLIC_*`, prerendering) is never exercised locally. This is not hypothetical: it is exactly how the `08-skills` failure below reached `main`'s CI unnoticed. To reproduce a CI-only e2e failure, copy the script and swap that one line for `pnpm build && pnpm exec next start -p "$WEB_PORT"` (also raise the readiness loop above 60 s — a prod build overruns it). Treat a local pass as necessary, never sufficient.
- **(2026-07-29, later — resolves the entry above)** `scripts/e2e.sh` now runs the production build itself (`pnpm build && pnpm exec next start`), so the copy-and-patch workaround described above is obsolete and a local pass **is** now CI-representative for this class of bug. The readiness loop went 60 → 300 iterations, because the clock now has to cover a full build (60 s reliably times out before `next build` finishes). Proven by mutation rather than assumption: with `08-skills`'s `--exact` reverted, the updated script reports **8/9**, matching CI exactly, where the `next dev` version reported 9/9 on that same code. Cost is ~40 s of build per run. If anyone reinstates `next dev` for speed, they are re-opening this specific blind spot.

## Recurring Errors & Fixes
<!-- Error signature → root cause → fix. -->
- **(2026-07-29) `Command failed: … find text "X" click` reporting `Element … is covered by <aside> at its click point` on a PRODUCTION build only → `find text` matched the RSC flight payload, not your UI.** Next.js inlines route data into `<script>self.__next_f.push([1,"…X…"])</script>` in a production build, and `find text` matches on **substring**, so any string that also appears in that payload has two text-node matches: the script and the real element. agent-browser resolves the script, which has no layout, so its click point falls at the page origin — under the sidebar `<aside>` — and it correctly refuses to click through. `next dev` serializes the payload differently, so the same step passes locally (see Tool & Library Notes on the dev/prod gap). **Fix: add `--exact`** — the script's text content is the whole `self.__next_f.push([…])` blob and cannot match exactly, while the target element's text is exactly `X`. Diagnosed on `08-skills.flow.json:11` (`pr-quality-rubric`); the app was never at fault, a DOM `.click()` on the real `<span class="mono">` navigated to `/skills/<id>` fine. Note the role-based remedy in What Works does **not** apply here: `SkillCard.tsx:29` renders the clickable card as a bare `<div onClick>` with `role`/`tabindex` null all the way up the ancestry, so there is no role to target (a real a11y defect, left unfixed — the card is not keyboard-reachable).
- **(2026-07-28 — corrects the Open Questions entry on `04-pr-findings` / `05-pr-diff`)** `Command failed: agent-browser find text "X" click` has **two** distinct root causes behind one signature, and the What Works entry above only covers the first. **(a) Ambiguity** — "X" matches several text nodes (the `Tabs` case); fix is `find role button click --name "X"`. **(b) Timing** — "X" is unique but hasn't painted yet; fix is a preceding `["wait","--text","X"]`. **Tell them apart by asking whether another spec clicks the same string successfully.** The Open Questions entry assumed (a) for `04`/`05` and prescribed a role-based locator rewrite; it was actually (b). `02-repo-pulls-detail.flow.json:7-8` does `wait --text` and then the *identical* `find text … click` on the same PR-row title and passes — which rules out ambiguity outright. `04`/`05` went straight from `["wait","--url","/pulls"]` to the click, and the route commits before the PR list renders, so `find` ran against an empty list. Adding the one missing `wait --text` line to each took the hermetic suite 7/9 → 9/9, with no locator change. General rule: **`wait --url` is a navigation barrier, not a render barrier** — never click a data-dependent row on the strength of a URL wait alone.

## Session Notes
<!-- Dated wrap-ups, newest first: ### YYYY-MM-DD — <one-line summary> -->
### 2026-07-29 (later) — Closed the dev/prod gap: `scripts/e2e.sh` now builds and serves the production app like `e2e-web.yml` does. Mutation-checked (reverting `--exact` now yields 8/9 locally, as on CI). See Tool & Library Notes.
### 2026-07-29 — CI's first-ever run of these flows caught `08-skills` failing on the production build only (`find text` hitting the RSC flight payload); fixed with `--exact`, 9/9 against a local prod build. Root of the blind spot: `scripts/e2e.sh` uses `next dev` — see Tool & Library Notes.
### 2026-07-28 — Fixed `04-pr-findings` + `05-pr-diff` with the one missing `wait --text` step, not the role-locator rewrite Open Questions predicted; hermetic suite 7/9 → 9/9. See the dated correction in Recurring Errors & Fixes.
### 2026-06-21 — Added 08-skills + 09-agent-skills flows (Skills Lab + agent Skills tab); switched tab clicks to role-based find after `find text click` broke on agent-browser 0.29.1

## Open Questions
<!-- Unresolved threads for the next session. -->
- `specs/04-pr-findings.flow.json` and `05-pr-diff.flow.json` fail on `["find","text","Add rate limiting to public API endpoints","click"]` (the PR #482 row) under agent-browser 0.29.1 — same `find text click` non-unique-node issue as above, NOT a regression from the skills feature. Fix is to switch that PR-row click to a role-based locator (e.g. `find role link click --name …`) like the skills flows now do. Left untouched as out-of-scope for the skills work.
