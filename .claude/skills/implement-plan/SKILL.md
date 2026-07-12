---
name: implement-plan
description: "Orchestrates the Implement -> Verify -> Review (-> fix loop) stage of Spec-Driven Development for an ALREADY-WRITTEN Implementation Plan. Takes the plan (path or pasted), plus optional extra requirements prompt, design references, and execution mode (parallel waves by default, or sequential one-task-at-a-time), dispatches `implementer` agents (each in its own git worktree), merges each wave into an integration branch, runs `plan-verifier` for completeness, runs `architecture-reviewer` for structure, and auto-fixes Critical/High findings for up to 2 review iterations before handing control back to the user. Never runs spec-creator or implementation-planner — those are separate, manual, upstream steps. Does not run test-writer (currently disabled by design; add tests manually). Invoke manually with /implement-plan."
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# Implement Plan

Runs the **Implement → Verify → Review** stage of this project's Spec-Driven
Development lifecycle (`.claude/agents/README.md`) against an Implementation
Plan that already exists. You are the **orchestrator** described in that
README's "Orchestration protocol" section — there is no separate orchestrator
agent; the session running this skill does the dispatching, merging, and
looping directly.

## Out of scope — do not do these

- **Never invoke `spec-creator`.** If the user hands you a raw feature idea
  with no Implementation Plan, stop and tell them to run `implementation-planner`
  first (and `spec-creator` before that, if there's no spec either). Do not
  improvise a plan yourself.
- **Never invoke `implementation-planner`.** Same rule — planning is a separate,
  manual step the user runs beforehand in their own turn.
- **Never invoke `test-writer`.** Test authoring is intentionally excluded from
  this skill for now. Say so plainly in the final report — the user runs it by
  hand later.
- **Never invoke `doc-writer` or open a PR.** Out of scope; mention them as
  optional next steps in the final report, don't run them.

## Inputs

Ask for whatever wasn't already given, before doing anything else:

1. **Implementation Plan** (required) — a file path (e.g. `docs/plan/*.md`) or
   pasted plan text following the `implementation-planner` output template.
   If neither is available, stop (see "Out of scope" above).
2. **Extra requirements prompt** (optional) — free text with anything not
   captured in the plan file. Fold it verbatim into every dispatched
   `implementer` task's prompt as additional context; never let it silently
   override a task's declared file scope or "Done when" criteria — if it
   conflicts with the plan, surface the conflict to the user before dispatching
   anything.
3. **Design references** (optional) — paths under `design/**`. Pass the
   relevant path(s) to any task whose module is `client` or whose scope
   plainly needs a visual reference; don't force it onto backend-only tasks.
4. **Execution mode** (optional, default `parallel`) — if the user says
   "sequential" / "one at a time" / "не паралельно" (however phrased), switch
   to **sequential mode**: every `[P]` marker in the plan is ignored and every
   task — regardless of how the planner tagged it — becomes its own
   single-task wave, dispatched and merged one at a time in plan order (still
   respecting `depends on`). Everything else in Steps 1–4 (worktree per task,
   merge-then-next, the fix loop) works identically; only the "dispatch
   multiple `Agent` calls in one message" part of Step 1.2 is skipped. State
   which mode is active at the top of the final report.

## Step 0 — Read the plan, build the graph

1. `Read` the plan. Extract the `Task breakdown` section: task IDs, `[P]`
   markers, `(depends on: ...)`, `Files owned`, `Skills to load`, `Insights to
   apply`, `Tests owned by`, `Done when`.
2. If a task's `Tests owned by: test-writer` field exists, note it in your
   final report as deferred — do not act on it now (test-writer is disabled
   for this skill, see "Out of scope").
3. Build the dependency graph from `(depends on: ...)`. If the plan is
   malformed (missing IDs, a cycle, a `[P]` task sharing files with another
   `[P]` task in the same wave), stop and report the problem — do not guess a
   fix into the graph.
4. Determine an **integration branch** for this run (the plan's target
   feature branch — ask the user if it isn't obvious from context) and
   confirm the working tree is otherwise clean (`git status`) before touching
   anything.

## Step 1 — Waves: dispatch, verify, merge

Repeat until every task is merged:

1. **Compute the next wave.**
   - **Parallel mode (default):** the maximal set of not-yet-merged tasks
     whose `depends on` are all already merged. `[P]` tasks in the wave are
     dispatched together; a non-`[P]` task is a wave of one.
   - **Sequential mode:** the single next not-yet-merged task in plan order
     whose `depends on` are all already merged — one task, always.
2. **Dispatch.** For a multi-task wave (parallel mode only), call the `Agent`
   tool once per task, **all in the same message** (true parallelism); in
   sequential mode, call it once and wait for that task to finish (merge it,
   per Step 1.4) before dispatching the next. Either way: `subagent_type:
   "implementer"`, each prompt containing the task's full spec from the plan
   (scope, files owned, skills to load, insights to apply, done-when), plus
   any relevant extra-requirements text and design paths from the Inputs
   step. One task per call — never bundle two plan tasks into one dispatch.
3. **Check reports.** Each `implementer` returns `tsc`/`tests: PASS|FAIL` and
   a self-review note. A task reporting `FAIL` or "blocked" does **not** get
   merged — pause, surface it to the user with the agent's own evidence, and
   ask whether to retry, skip, or abort the whole run. Never merge on a
   fabricated or partial PASS.
4. **Merge.** For each passing task in the wave, `git merge` its worktree
   branch into the integration branch, one at a time. `[P]` tasks were scoped
   to disjoint files by the planner, so this should be a clean merge — a real
   conflict means the plan under-scoped `[P]` tasks; stop and report it rather
   than resolving it silently.
5. Move to the next wave, computed from the now-updated integration branch.

## Step 2 — Completeness: plan-verifier

Once every task is merged, call `Agent` with `subagent_type: "plan-verifier"`,
passing the plan (path or text) and pointing it at the integration branch.
Record its traceability matrix and verdict. `Missing`/`Partial` items are not
auto-fixed here — report them to the user at the end; this skill's fix loop
(Step 3) only reacts to `architecture-reviewer` findings, not completeness
gaps, since a missing requirement usually needs a new plan task, not a patch.

## Step 3 — Structure + fix loop: architecture-reviewer

1. Call `Agent` with `subagent_type: "architecture-reviewer"` against the
   integration branch (the whole diff since the plan's base, not one task).
2. If there are no `Critical`/`High` findings, skip to Step 4.
3. Otherwise, **fix loop — max 2 iterations total:**
   - Group findings by the file(s) they anchor to. Dispatch one `implementer`
     per group — parallel (one message, multiple calls) in parallel mode,
     one-at-a-time in sequential mode, same rule as Step 1 — with a task
     prompt built from the finding's `What` / `Why it matters` /
     `Suggested direction` — not a vague "fix architecture issues".
     `Medium`/`Low` findings are noted in the final report, not auto-fixed.
   - Merge each passing fix the same way as Step 1.4.
   - Re-run `architecture-reviewer` on the updated integration branch.
   - If clean (or only `Medium`/`Low` remain), stop the loop and continue to
     Step 4.
4. **After 2 iterations, if `Critical`/`High` findings still remain: stop.**
   Do not attempt a third automatic fix. Hand the outstanding findings to the
   user in the final report — this is a deliberate cap, not a failure to
   report honestly.

## Step 4 — Final report

```
# Implement Plan — <plan name>

## Execution mode
<parallel | sequential>

## Waves executed
- Wave 1: T1, T2 [P] — merged
- Wave 2: T3 — merged
...

## plan-verifier verdict
<COMPLETE / INCOMPLETE (N of M unmet) / CANNOT-VERIFY> — <one line>
<Missing/Partial items, if any>

## architecture-reviewer verdict (after <k> fix iteration(s))
<sound / sound-with-risks / has architectural defects>
<remaining Critical/High findings, if the 2-iteration cap was hit>
<remaining Medium/Low findings, noted but not auto-fixed>

## Deferred (not run by this skill)
- Tests: test-writer was not invoked — <list of "Tests owned by" tasks from the plan>
- pr-self-review: optional, run manually before opening a PR
- doc-writer: optional, run manually if docs are needed

## Integration branch
<branch name> — ready for: <next recommended step>
```

## Rules

- **Read the plan, never author one.** If requirements are unclear or the
  plan is incomplete, that's a job for `implementation-planner` in a separate
  turn — stop and say so rather than improvising.
- **Evidence over assertion.** Every merge is gated on a real `implementer`
  report showing `PASS`, every fix-loop iteration is gated on a real
  `architecture-reviewer` re-run. Never mark a wave merged or a finding fixed
  without the agent output backing it.
- **Respect the fix-loop cap.** Two iterations, then stop and report — this is
  intentional, not a bug.
- **No test-writer, no doc-writer, no PR.** Out of scope for this skill; name
  them as next steps, don't run them.
- **Language mirrors the request.** Keep identifiers, paths, and commands
  verbatim; reply in the language the user wrote in.
