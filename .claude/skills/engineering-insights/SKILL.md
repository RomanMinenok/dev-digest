---
name: engineering-insights
description: Captures non-obvious engineering lessons into the touched module's INSIGHTS.md (server / client / reviewer-core / e2e). Use at the end of any substantive (>30 min) coding session as a wrap-up, and mid-session the moment something non-obvious surfaces (a gotcha, a dead end, a fix, a decision). Also use to read the relevant INSIGHTS.md before starting work. Invoke manually with /engineering-insights.
---

# Engineering Insights

A learnings loop: the previous session leaves notes the next one reads. Each
module owns an `INSIGHTS.md` next to its code, written **append-only** in 7 fixed
sections. This skill both **consumes** (read before work) and **produces**
(capture after / during work) those notes.

## Where insights live (routing)

Pick the file by which module the edited files belong to:

| Edited path        | Target file                  |
| ------------------ | ---------------------------- |
| `server/`          | `server/INSIGHTS.md`         |
| `client/`          | `client/INSIGHTS.md`         |
| `reviewer-core/`   | `reviewer-core/INSIGHTS.md`  |
| `e2e/`             | `e2e/INSIGHTS.md`            |

- Touched several modules → write each insight to the module it concerns (one
  insight can land in only one module's file).
- No clear module (root scripts/tooling, `shared` vendored copy) → put it in the
  most-touched module; if none fits, skip — these four files are the only homes.

## Read-first (start of work)

Before acting on a task, read the touched module's `INSIGHTS.md` and treat it as
high-confidence guidance. Skim all 7 sections; apply anything relevant
(especially **What Doesn't Work** and **Recurring Errors & Fixes**). If it
contradicts the current request, follow the request but flag the conflict.

## When to capture

Dual trigger:
- **Wrap-up** — at the end of a substantive session (>30 min) that had a problem,
  a decision, or a discovery.
- **Capture-as-you-go** — the moment something non-obvious surfaces mid-session,
  don't wait for the wrap-up.

Skip trivial sessions (a rename, a formatting pass, a one-line config tweak with
no surprise). Signal quality over volume.

## The 7 sections — what goes where

| Section                  | Put here                                              |
| ------------------------ | ----------------------------------------------------- |
| **What Works**           | An approach/solution that worked, with the why.       |
| **What Doesn't Work**    | Dead ends & antipatterns. Most valuable, most skipped — don't skip it. |
| **Codebase Patterns**    | Conventions & architectural decisions (the "why").    |
| **Tool & Library Notes** | Dependency quirks, version gotchas, env/config oddities. |
| **Recurring Errors & Fixes** | Error signature → root cause → fix.               |
| **Session Notes**        | One dated line per wrap-up, newest first.             |
| **Open Questions**       | Unresolved threads for the next session.              |

## Quality bar — concrete, not banal

An entry must be actionable read **cold** by someone who never saw this session.

Test: *"if it's obvious to anyone reading the code, don't write it."*

- ✗ "Promises can be tricky." / "Be careful with async."
- ✓ "`Promise.all()` on the ingest pipeline times out past ~30 items — use
  `Promise.allSettled()` batched by 10 (see `run-executor.ts`)."
- ✓ "Checkout state goes through Zustand (`cartStore.ts`), never local state —
  three components share the cart."

Rules: one insight per entry; cite evidence as `path/file.ts:line`; include the
*why*, not just the *what*.

## Wrap-up procedure

1. Review what happened this session; list candidate insights.
2. Drop the obvious ones (apply the quality test above).
3. For each survivor, run the **dedup + significance gate** (below). Read the
   target file first.
4. Append the survivors under the correct section of the correct module's file.
5. Add **one** dated line to that file's `## Session Notes`, newest first:
   `### YYYY-MM-DD — <one-line summary>` (use today's real date).
6. If nothing survives the gate, write nothing — an unchanged `INSIGHTS.md` is a
   valid, expected outcome.

## Dedup + significance gate (run before any write)

Read the target `INSIGHTS.md`, then **skip** the entry if either holds:

- **Duplicate** — the same or a substantially equivalent insight already exists
  in that file (don't restate it, even reworded).
- **Not significant** — it fails the "obvious to a code reader" test, or it's a
  trivial config/formatting change with no surprise.

Append-only never means duplicate. If an existing entry is now **wrong**, do not
edit or delete it — add a new dated correction entry that references it.

## Append-only discipline

Only ever **add** to these files; never rewrite or delete existing entries (it
causes merge conflicts and erases others' lessons). Add to the right section,
keep `Session Notes` newest-first.

## Automation

This skill is the manual/`/engineering-insights` path. A `Stop` hook
(`.claude/hooks/engineering-insights-stop.sh`) also fires the wrap-up
automatically at the end of a session, and a `UserPromptSubmit` hook
(`.claude/hooks/engineering-insights-read.sh`) nudges the read-first step. See
`.claude/settings.json`.
