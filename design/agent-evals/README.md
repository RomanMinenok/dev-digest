# Design — Agent Evals

Reference screenshots for [`SPEC-03-agent-evals`](../../specs/SPEC-03-agent-evals.md).
Supplied by the requester during the spec interview (2026-07-14).

| File | Shows | Read it for |
| --- | --- | --- |
| `01-finding-card-turn-into-eval-case.png` | PR page › Review Runs, a Security Reviewer run expanded, with the `Turn into eval case` action highlighted on a finding card | The entry point (AC-1). Also shows `Learn` and `Reply to author` — both **out of scope**, see the spec's Non-goals. |
| `02-eval-case-modal.png` | The eval-case modal (`stripe-key-leak`): Name, the Diff / Files / PR meta input tabs, the Expected output JSON editor with its `valid JSON` badge and `Finding skeleton` button, the last-run summary strip, and the `Run on save` toggle | The modal's contract (AC-7 – AC-12). Note the expected output is a **plain array** of finding skeletons — that shape is what the spec locks in. |
| `03-agent-editor-evals-tab.png` | Agent Editor › Evals: the metric cards, `N / M passing`, `Run all evals`, `New eval case`, and the per-case rows with their pass / fail / never-run states | The tab layout (AC-31 – AC-37). |

## Where the spec deliberately departs from these mockups

These are decisions the requester made during the interview — the screenshots
are *older* than the spec, so where they disagree, the spec wins:

- **The `TRACES PASSED 17/20` card is dropped.** It duplicated `N / M passing`
  over the case list with no distinct meaning. Only Recall, Precision and
  Citation Accuracy remain as cards.
- **`View full dashboard →` is a disabled placeholder**, not a link — the Eval
  Dashboard page is a non-goal.
- **`Learn` and `Reply to author`** on the finding card are not built here.
- The `Stats` and `CI` tabs visible in the Agent Editor are later lessons.
