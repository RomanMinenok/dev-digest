# agent-runner — open risks after the Export-to-CI PR

**Status:** recorded 2026-07-28 · source: review of PR #31 ("Lesson 7 Export agent to CI", merged 2026-07-28)
**Owner:** unassigned
**Scope:** risks that were found alongside the two build/packaging defects fixed in the follow-up PR. Nothing here is a live outage — all of it is latent.

## Background in one paragraph

`agent-runner/` is compiled into a single self-contained file that gets copied into a customer's repository as `.devdigest/runner/index.js` and executed by their own GitHub Actions on every pull request. It carries the same review engine the studio uses, so an agent tuned in DevDigest behaves the same way in someone else's CI. It reports back by uploading a result file that DevDigest later ingests and displays on the **CI Runs** page.

Two defects in that packaging — a broken build config and a bundle that was never committed — are fixed separately. The four items below were left open deliberately: each needs a product decision or a larger change, not a one-line repair.

---

## R1 — Renaming an agent silently disconnects its CI results

**What happens.** DevDigest finds a customer's CI results by matching on the agent's *name*. The customer's repository has that name baked in from install time. Rename the agent in the studio and the two stop matching.

**Who feels it, and how.** A user renames "General Reviewer" to "Backend Reviewer". Reviews keep appearing on their pull requests exactly as before — the exported reviewer is unaffected. But the **CI Runs** page quietly stops receiving new rows. There is no error, no warning, no empty state explaining why. From the user's side, DevDigest simply stopped noticing runs that are visibly still happening.

**Why it's worth fixing.** This is the most likely of the four to reach support, and the hardest to diagnose from the outside — the symptom (missing data) is far from the cause (a rename days earlier).

**Shape of the fix.** Either store the installed identifier alongside the installation record so it survives renames, or have the exported reviewer state its own identity in the result file and match on that. Roughly a day, mostly on the server side. The second option also makes results self-describing, which is the direction the rest of the design already went.

**Interim mitigation.** Warn in the UI when renaming an agent that has a live CI installation.

---

## R2 — The exported reviewer will not start in some customer repositories

**What happens.** The compiled file uses modern JavaScript module syntax but is shipped with a filename that older conventions treat as the legacy format. It works today because recent Node.js versions detect the difference automatically — a behaviour that a large, common class of JavaScript projects explicitly turns off in their own configuration.

**Who feels it, and how.** For those customers, the very first review after installing fails to start at all. Not a bad review — a crash, on the first pull request after onboarding. Worst possible moment for a first impression, and the error message points at our file, in their repository, with no obvious owner.

**Why it's worth fixing.** We do not currently know what share of repositories are affected. It is invisible in our own repo (which happens to be configured the permissive way), so internal testing will never surface it.

**Shape of the fix.** Ship the file under an extension that removes the ambiguity, or compile to the legacy format instead. Small change (under half a day) but it changes the filename written into customer repositories, so it needs to land before wider rollout — afterwards it means re-exporting every existing installation.

**Worth measuring first.** Sample real repositories to size the exposure before deciding urgency.

---

## R3 — CI reviews are not quite the same review as the studio's

**What happens.** An agent can have reference documents attached to it. The studio feeds those documents to the model as part of the review. The exported version does not — they are not included in what gets installed, and the runner never looks for them.

**Who feels it, and how.** A user tunes an agent in the studio until it behaves the way they want, exports it, and gets noticeably different results in CI. Everything looks correctly configured; the difference is invisible in the UI. This undermines the core promise of the feature — "the same agent, everywhere."

**Scope.** Only affects agents that use attached documents. Agents without them are genuinely identical across both paths. A related, smaller gap: the studio also injects a pull request's declared intent, which CI has no access to.

**Shape of the fix.** Include the documents in what gets installed and have the runner read them at review time. Two to three days across the export path, the installed format, and the runner. Needs a product call on whether large documents should be copied into customer repositories at all.

**Recommendation.** Until it is fixed, either hide or warn on export for agents that have documents attached, rather than letting them silently degrade.

---

## R4 — No test coverage on the changed runner code

**What happens.** PR #31 changed four files in the runner — including how it picks which agent to run and what it reports back — and added no tests for any of it. The existing suite could not even be executed until the build fix landed.

**Who feels it.** Nobody today; the suite is green and the feature works. It is a cost that lands on the *next* change to this component, which is also the component whose failures are hardest to observe: it runs inside customer infrastructure, and its output is a file we read hours later.

**Shape of the fix.** Cover the two behaviours the PR introduced — selecting the right agent when a repository has several, and producing a complete, well-formed result file. Half a day. Worth doing before R1 or R3, since both will touch exactly this code.

---

## Suggested order

1. **R4** — cheap, and makes the rest safer to attempt
2. **R2** — before the installed-file format is locked in by real customers
3. **R1** — highest chance of generating a confused support ticket
4. **R3** — genuine feature work; needs a product decision, not just engineering time

## Also noted, not tracked as risks

- The result file's version marker was not incremented when its contents changed, so old and new installations are indistinguishable on ingest. One line, worth doing next time the file changes.
- The empty memory file placed in customer repositories has no reader yet. This is by design — the memory feature is not built on either side.
- The studio and the runner now build their run records through two different code paths. They agree today. Consolidating them would remove a future source of drift.
