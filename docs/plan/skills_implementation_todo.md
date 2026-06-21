# Skills — TODO / Open Issues

> Companion to `skills_implementation_plan.md`. Tracks known gaps that are
> **out of scope for the first iteration** but need resolving before the
> Stats/Evals tabs are truthful.

## Issue 1 — Per-skill Stats are not computable from the current schema

### Summary
The design's **Stats** tab shows `USED BY`, `PULL FREQUENCY`, `ACCEPT RATE`,
`FINDINGS (30D)`, and a `FINDINGS BY CATEGORY` donut. Only **USED BY** is real.
The rest cannot be computed today and ship as `null` / "no data yet"
placeholders.

### Root cause
A skill is just **text appended to one prompt** (`## Skills / rules` block). The
agent makes **one LLM call** and returns **one flat list of findings**. The model
never labels which skill produced which finding, so per-skill provenance is lost
at prompt-assembly time. The schema confirms it:

```
findings.review_id → reviews.id
reviews.run_id     → agent_runs.id
reviews.agent_id   → agents.id
```

- `findings` has `category`, `severity`, `acceptedAt`, `dismissedAt` — **no `skill_id`**.
- There is **no record of which skills were injected into which run** (the
  `agent_versions` snapshot stores linked skill ids at config time, and the run
  trace's `prompt_assembly.skills` is a concatenated blob, not per-skill ids).

### What this means for "did a skill reject/flag a change"
"Accept" / "reject" are properties of a **finding** (`acceptedAt`/`dismissedAt`,
set by the developer) and of an **agent run** (`verdict` + blocker count) — never
of an individual skill. Accept rate is computable **per agent**, but cannot be
split across the 3–6 skills that were all in that agent's prompt.

### Metric-by-metric status

| Metric | Status | Blocker |
|---|---|---|
| `USED BY` (N agents) | ✅ Real | `COUNT agent_skills` + join `agents` |
| `PULL FREQUENCY` (% pull) | ❌ Placeholder | no log of which skills were injected per run |
| `ACCEPT RATE` (%) | ❌ Placeholder | no finding→skill attribution |
| `FINDINGS (30D)` | ❌ Placeholder | no finding→skill attribution |
| `FINDINGS BY CATEGORY` (donut) | ❌ Placeholder | no finding→skill attribution |

### Options to make them real (future work)

1. **Prompt-inclusion log → unlocks PULL FREQUENCY only.**
   Record, per run, the skill ids actually injected (new `run_skills` join table,
   or store ids in the run trace). Then `pull% = runs_with_skill / runs_of_its_agents`.
   *Cost:* low. *Does not help accept rate.*

2. **Tag findings with their skill → unlocks ACCEPT RATE + FINDINGS.**
   Add `skill_id` (or `skill_slug`) to the finding output schema; instruct the
   model to label which rule each finding came from; persist on `findings`
   (migration). Accept rate / findings-by-category per skill become real.
   *Cost:* medium-high; invasive (schema + prompt change); reliability depends on
   the model tagging correctly.

3. **Eval harness — the architecturally-intended path.**
   The schema already has `eval_cases.ownerKind = 'skill'` and the design's
   **"Run on evals"** button. The designed way to measure a skill's quality is to
   run it against curated cases and measure precision/recall/citation-accuracy in
   isolation — not to scrape production traffic. Requires the (not-yet-built)
   eval module. This is the real per-skill quality signal; the production
   accept/pull/findings numbers are vanity metrics until option 1 or 2 lands.

### Decision for iteration 1
Ship the one honest number (`USED BY` + the clickable "Agents using this skill"
list); render the other Stats fields as "no data yet"; keep the Evals tab and
"Run on evals" as a stub. Revisit via option 1/2/3 in a later lesson.
