# Design reference — Multi-Agent Review (SPEC-05-multi-agent-review)

Five screenshots supplied by the requester during the SPEC-05 interview, committed
alongside this description:

- [`01-pr-agent-picker-dropdown.png`](./01-pr-agent-picker-dropdown.png) — PR page, "Pick agents to run" dropdown open
- [`02-configure-run-empty.png`](./02-configure-run-empty.png) — Multi-Agent Review › Configure run, empty state
- [`03-configure-run-agents-selected.png`](./03-configure-run-agents-selected.png) — Configure run with a PR chosen and 4/5 agents checked
- [`04-results-columns.png`](./04-results-columns.png) — results in **Columns** mode + the "Where agents disagree" block
- [`05-results-tabs-detail.png`](./05-results-tabs-detail.png) — results in **Tabs** mode with an expanded finding detail

The written description below is authoritative where the spec departs from the
mocks (see the table at the end). The mocks' sample values (`8.2s`, `$0.06`,
score `38`, PR `#482`) are illustration, not requirements.

---

## 01 — PR page, agent picker

Standard PR detail page (`/repos/[repoId]/pulls/[number]`): breadcrumb
`acme/payments-api › Pull Requests › #482`, PR title, author/branch/diffstat
line, tabs `Overview` / `Agent runs` / `Files changed`, and the existing PR Brief,
Intent, and Blast Radius cards below.

Top-right actions: `View on GitHub`, **`Run Review ⌄`**, `Compose review ⌄`.
The picker is the **contents of the existing `Run Review` dropdown** — the trigger
button keeps its current label; no new button is added. `Compose review` is a
different feature and is not touched.

Open dropdown, top→bottom:

- header row: `PICK AGENTS TO RUN` (muted) + **`Clear`** (right, link-styled)
- one row per agent: checkbox (checked) · icon · agent name · a right-aligned time
  hint (`~6s`)
- a full-width primary button **`Run multi-agent review (2)`** with a group icon
- a muted footer link `⚙ Configure agents…`

This **replaces** `RunReviewDropdown`'s current "Run all enabled agents / a
specific agent" item list. Running exactly one agent = checking exactly one box.

## 02 — Configure run, empty state

Route `/multi-agent-review`, sidebar item **Multi-Agent Review** active in the
`GLOBAL` group. Empty state: *"Pick a pull request first"* — a PR picker and no
agent list, no estimate, no run button.

## 03 — Configure run, agents selected

Same page with PR **#482** chosen. Header `Configure run`, a **`Select all`**
action, and one row per agent:

| icon | agent name | one-line gist | right-aligned `8.2s · $0.06` | checkbox |

Four of five agents are checked. Footer: a primary **`Run multi-agent review (4)`**
button with the estimate **`≈ 8.2s · $0.20 · parallel fan-out`** beside it —
i.e. the total duration is the **max** across the checked agents (they run in
parallel) while the total cost is their **sum**. Both are derived from past runs;
the mock does not show the no-history case (see the deviation table).

## 04 — Results, Columns mode

Breadcrumb `Multi-Agent Review › #482`. Header row: a **`⚙ Configure run`** back
button, title `Multi-Agent Review`, subtitle `4 selected agents · parallel`, and a
segmented **`Columns` / `Tabs`** switcher (right). Below it, a context strip: the
PR number and title (left) and `4 agents · fan-out via worktrees · 8.2s total ·
$0.20` (right).

**One column per agent**, each with:

- header: agent icon + name, `8.2s · $0.06`, and a **score ring** (`38`, `64`,
  `72`, `58`) coloured by score
- a stack of finding cards: severity icon, title, `file.ts:line` in monospace,
  with a coloured left border by severity
- footer: **`View trace`** (left) · `N findings` (right)

**`WHERE AGENTS DISAGREE`** block below, with a **`Show only conflicts`** toggle
(right). One card per code location:

- location header: `<> src/middleware/ratelimit.ts:28` + a short label (`Magic
  number 3600`)
- a row of per-agent cells: agent name, then either a verdict chip
  (`● SUGGESTION`, `● WARNING`) or a muted `● did not flag`

The spec reshapes this block substantially — the mock's heading, its toggle, its
per-group column trio, and its `:52` grouping are all superseded. See the
deviation table.

## 05 — Results, Tabs mode

Same page, `Tabs` selected. A tab per agent, each with the agent's icon, name and
a score badge (`Security 38`, `Performance 64`, `Junior Mentor 72`,
`Customer-Facing 58`).

The active tab shows:

- **agent summary card** — score ring, agent name, a prose verdict, and
  `View trace` + `8.2s · $0.06` on the right
- **finding cards**, collapsed to severity icon + title + category chip +
  `file.ts:line` + `98% conf`; the expanded one adds a prose explanation, a
  **`SUGGESTED FIX`** section, and an action row:
  `✓ Accept` · `✕ Dismiss` · `Learn` · `Turn into eval case` · `Reply to author`
- the same `WHERE AGENTS DISAGREE` block as screen 04

---

## Summary of deliberate departures from the mocks

| Mock | Departure | Why |
| --- | --- | --- |
| 05 | **`Learn` and `Reply to author` are not rendered at all** — not disabled, not "coming soon" | `actOnFinding` (`server/src/modules/reviews/findings.ts`) supports only accept/dismiss and throws `invalid_action` for anything else; no backend exists. Requester chose hiding over placeholders |
| 04 / 05 | **The rationale sentence under `did not flag` is dropped** ("Not a security concern.", "No perf impact.", "Cosmetic; out of scope for arch review.") | No agent produces such a sentence and no field holds one — it could only come from a new LLM call, and this feature makes zero model calls. Only the words "did not flag" render; no space or nullable field is reserved |
| 04 / 05 | **The 5th agent (`Architecture`) in the disagree groups is ignored** — only agents that are members of the multi-run appear in a group | The mock shows a verdict from an agent that has no column and no tab, i.e. was never run. Treated as mock inaccuracy |
| 04 / 05 | **The block becomes a matrix of ALL locations**, not a pre-filtered disagreement list | Filtering is the filter control's job (below); the block itself is rows = locations × columns = agents |
| 04 / 05 | **Every member agent gets a column in every row, in the lanes' order.** The mock shows a different trio of 3 agents per group | With a per-group column set the reader must re-map the columns on every row. Stable order is the whole value of a matrix |
| 04 / 05 | **`Show only conflicts` (a 2-state toggle) becomes a 4-state filter**: All · Matched · Divergent · Agreed | "Conflict" conflated "several agents flagged this" with "they disagree". The four states separate those, and All is the default |
| 04 | **The two groups at `src/middleware/ratelimit.ts:52` ("Retry-After header omitted on 429" and "429 response shape") are ONE group** — the group drawn as "429 response shape" does not exist | Grouping is coordinates only (same file + intersecting lines). Title similarity classifies *within* a group; putting it in the grouping rule would make the Divergent filter empty by construction |
| 04 / 05 | **Severity disagreement between agents is not surfaced** — not a filter state, not a badge | Explicit Non-goal. Divergence is measured on titles; severity only appears as a cell's own value |
| 04 / 05 | **The block does not render until every member run is terminal** — the lanes/tabs above stay live throughout | While a run is in flight we cannot know whether it would flag a location; showing "did not flag" would be a lie that rewrites itself seconds later. Only this block waits |
| 04 / 05 | **The block's heading is an open question**; "Where agents disagree" is retired | The block now defaults to showing all locations, and divergence is one filter state of four. Working title "Findings by location" — see the spec's `[NEEDS CLARIFICATION]` |
| 04 / 05 | `fan-out via worktrees` in the context strip is **not** reproduced as written | Review runs fan out in-process per agent (`ReviewRunExecutor.executeRuns`); no worktree is involved. The strip states the agent count, total duration and total cost only |
| 04 / 05 | A **failed** agent is a third per-agent state in a disagree group, alongside a verdict and `did not flag` | The mock has no failure state. The status is already on the `agent_runs` row, so surfacing it is nearly free — and a failed agent must not be read as a silent one (it counts as neither for the conflict test) |
| 04 | A failed agent's **column** shows `failed` + the run's error text and no score ring, but keeps `View trace` | Not in the mock; required because runs genuinely fail and the trace is the thing you want when they do |
| 03 | An agent with **no completed run history** shows `no history yet` instead of an estimate, is excluded from the totals, and turns the total's `≈` into `≥` | The mock assumes every agent has history. A median over zero runs has no honest value |
| 03 | The `≈ 8.2s` total is specified as the **max** of the per-agent durations, not their sum | They run in parallel; the mock's own numbers (four agents at ~7–8.2s totalling "8.2s") already imply max |
| 02 / 04 | The page is **global but always PR-scoped** (`/multi-agent-review?pr=<id>`), showing only the **latest** multi-run for that PR — no history, no earlier runs | Sidebar places it in `GLOBAL` while the results header shows a specific `#482`; the empty state ("Pick a pull request first") resolves the ambiguity in favour of PR context |
| 01 | The trigger stays the existing **`Run Review`** button; the picker replaces the dropdown's *contents*, not the button | Matches the mock, and avoids adding a second run affordance next to the existing one |
| 04 / 05 | `View trace` opens the **existing** `RunTraceDrawer`, unmodified, defaulting to Live log while the run is in flight | The drawer already does all of this via its `running` prop; it moves to `client/src/components/` for reuse from both routes (`client/CLAUDE.md`'s promotion rule) and is otherwise untouched |
