# Design reference — Eval Dashboard (SPEC-04-eval-dashboard)

Three screenshots supplied by the requester during the SPEC-04 interview, committed
alongside this description:

- [`01-eval-dashboard.png`](./01-eval-dashboard.png) — Eval Dashboard (Agents cards + Recent Eval Runs · all agents)
- [`02-agent-screen.png`](./02-agent-screen.png) — Agent screen (metric cards, Metric Trend, Recent Runs)
- [`03-compare-runs-modal.png`](./03-compare-runs-modal.png) — Compare runs modal (v6 → v7)

The written description below is authoritative where the spec departs from the
mocks (see the table at the end).

---

## 01 — Eval Dashboard (all agents)

Dark theme, standard `AppShell`: left sidebar, breadcrumb `Skills Lab › Eval
Dashboard`, top-right search / refresh / notifications / avatar.

**Sidebar.** A new item **Eval Dashboard** (gauge/activity icon) sits in the
`SKILLS LAB` group, after `Conventions`, and is the active item. (The mock also
shows `Project Context` in that group, and a `GLOBAL` group with `Memory`,
`Multi-Agent Review`, `Agent Performance`, `CI Runs` — those are other lessons,
not part of this spec.)

**Header.** Title `Eval Dashboard`, subtitle *"Regression harness across all
reviewer agents · pick an agent to see its runs"*, and a primary button
**▷ Run all agents** on the right.

**Section `AGENTS`** — one row-card per agent, clickable, chevron on the right:

- agent name (bold) + a monospace model chip (`gpt-4.1`, `gpt-4o`, `gpt-4o-mini`)
- a secondary line: `Last run v7 · 2026-05-29 09:14 · 17/20 pass`
- a small sparkline (recall trend)
- three metric readouts, right-aligned: `RECALL 82%` (blue), `PREC 91%` (green),
  `CITE 95%` (amber)

Three agents shown: Security Reviewer, Performance Reviewer, Custom Mentor.

**Section `RECENT EVAL RUNS · ALL AGENTS`** — a flat table, newest first, one row
per eval run, columns left→right:

| agent name | ran-at (`2026-05-29 09:14`) | version chip (`v7`, blue text) | recall bar + `82%` | precision bar + `91%` | citation bar + `95%` | pass count (`17/20`, bold) |

Each metric is a small horizontal progress bar in the metric's colour followed by
the percentage. **Spec deviation:** the design has no `COST` column here; SPEC-04
adds one for consistency with screen 02. The `v7` chip looks like a link but is
*not* navigable (confirmed with the requester).

---

## 02 — Agent screen (Eval Dashboard › Security Reviewer)

Breadcrumb `Skills Lab › Eval Dashboard › Security Reviewer`. A `‹ All agents`
back link above the title.

**Header.** `Security Reviewer` + model chip `gpt-4.1`; subtitle *"Regression
harness · 5 runs on the 20-trace gold set"*. Right-aligned controls:
an **agent selector** dropdown (`⚙ Security Reviewer ⌄`), a **range picker**
(`📅 30 days`), and a primary **▷ Run eval** button.

**Regression banner** (amber, warning icon), full width:
> **Precision dipped 2pts** on v7 — a new false positive slipped in. Recall and citation both up.

**Three metric cards** — `RECALL` / `PRECISION` / `CITATION ACCURACY`. Each has a
label, a sparkline top-right, a large value (`82%`, `91%`, `95%`) and a delta
next to it: `↑ 0.04` green, `↓ 0.02` red, `↑ 0.01` green.

**`METRIC TREND` chart** — a multi-line chart, legend `— Recall — Precision —
Citation`, y-axis `0.6 … 1.0`, x-axis chronological (unlabelled tick marks); the
last point of each line is dotted. The plotted range visibly spans several agent
versions (v3 → v7), not just the current one.

**`RECENT RUNS` section** — header shows `2 selected` and a **Compare** button
(right). Table columns:

| ☑ checkbox | `RAN AT` | `VERSION` | `RECALL` (bar + %) | `PRECISION` (bar + %) | `CITATION` (bar + %) | `PASS` (`17/20`) | `COST` (`$0.23`) |

Five rows (v7, v6, v5, v4, v3); the top two are checked.

---

## 03 — Compare runs modal

Centered modal over a dimmed agent screen. Title **`Compare runs · v6 → v7`**,
subtitle *"Old prompt vs new — metric deltas and prompt diff on the 20-trace gold
set"*, close ✕ top-right.

**Four delta cards** in a row — `RECALL`, `PRECISION`, `CITATION`, `COST`. Each
shows `old → new` with the new value large and coloured, plus a delta chip:

- RECALL `78% → 82%` `▲ 4pt`
- PRECISION `93% → 91%` `▼ 2pt` (red)
- CITATION `94% → 95%` `▲ 1pt`
- COST `0.21 → 0.23` `▲ 0.02`

**`SYSTEM PROMPT DIFF`** — a legend of two colour swatches, `v6 (old)` (red) and
`v7 (new)` (green), above a monospace block showing the older version's system
prompt with the changed line highlighted (added line `Flag unused imports as
suggestions.` on a green background).

**Footer.** `Close` (secondary) and **`Promote v7`** (primary, branch icon).

**Spec deviation:** `Promote v7` is explicitly **out of scope** for SPEC-04 (see
that spec's *Non-goals*) — the modal ships with `Close` only, and no
restore/promote route is added.

---

## Summary of deliberate departures from the mocks

| Mock | Departure | Why |
| --- | --- | --- |
| 03 | `Promote v7` button dropped | Out of scope, decided in the SPEC-04 interview; no version-restore route exists or is added |
| 01 | `COST` column added to *Recent Eval Runs · all agents* | Consistency with the agent screen's run table |
| 01 | An agent with eval cases but zero runs still appears (no metrics, no sparkline, `Run eval` CTA) | "Agents that have evals" is read as "has ≥ 1 eval case"; a case-less agent is invisible here |
| 02 | Metric cards may read `last measured on v6` instead of the current version | Any agent config edit bumps `agents.version`; the mock implicitly assumes the current version is always measured |
| 02 / 03 | A row in *Recent Runs* is one **agent version**, so Compare is always between two *different* versions | The mock's run rows are already one-per-version (v7…v3); SPEC-04 makes that the model (see its "eval version run") |
