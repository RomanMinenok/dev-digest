# Findings by location — filter predicates

How the **All · Matched · Divergent · Agreed** tabs on the multi-agent results
page decide which location groups to show.

Implementation: `grouping.ts` (coordinates → groups) → `similarity.ts`
(flags on each group) → client filters rows by those flags
(`FindingsByLocation/helpers.ts`). Flags are computed on the server and
returned on each group in `MultiAgentRunView`; nothing is re-scored in the UI.

## Pipeline (what happens before filters)

1. **Group by location only** (`grouping.ts`). Same file + overlapping line
   range → one group. Title text does **not** affect which findings share a
   group. Two agents can disagree completely on wording and still land in the
   same row.
2. **Classify the group** (`similarity.ts`). Set boolean flags `matched`,
   `divergent`, `agreed` from title-token similarity across **cross-agent**
   pairs only (two findings from the same agent never form a pair).
3. **Filter in the UI.** Tabs are independent predicates — a group can appear
   under both Divergent and Agreed when its pairs span both thresholds.

## The four filters

| Filter | Shows a group when… |
| ------ | ------------------- |
| **All** | Always (default). Every location group, including single-agent ones. |
| **Matched** | ≥ 2 distinct agents contributed a finding at that location. Title similarity is ignored. |
| **Divergent** | Matched **and** at least one cross-agent title pair has Jaccard ≤ `0.3`. |
| **Agreed** | Matched **and** at least one cross-agent title pair has Jaccard ≥ `0.6` **or** containment ≥ `0.6`. |

Constants live next to the predicates in `similarity.ts`:

- `DIVERGENT_MAX_J = 0.3`
- `AGREED_MIN_J = 0.6`
- `AGREED_MIN_CONTAINMENT = 0.6`

They are tuning knobs, not sacred numbers — adjust against live multi-agent runs.

## Title metrics

Titles are tokenised: case-folded, split on non-alphanumeric runs, stored as a
**set** (duplicates dropped).

**Jaccard** — shared tokens over all unique tokens:

\[
J = \frac{|A \cap B|}{|A \cup B|}
\]

Penalises verbosity: a short title and a long expansion of the same idea share
few tokens relative to the union, so \(J\) stays mid-band even when humans
read them as the same finding.

**Containment** — how fully the shorter title sits inside the longer:

\[
C = \frac{|A \cap B|}{\min(|A|, |B|)}
\]

A short label like `"Hardcoded API Key"` fully embedded in a longer title
scores \(C = 1.0\) even when \(J \approx 0.4\). That is why Agreed ORs
containment in — without it, same-bug / different-verbosity pairs stay
Matched-only.

Empty token sets → both metrics return `0` (no evidence of agreement).

## Soft band (Matched only)

When every cross-agent pair has \(0.3 < J < 0.6\) **and** \(C < 0.6\), the
group is Matched but neither Divergent nor Agreed. That is intentional: agents
flagged the same place, but titles are neither clearly conflicting nor clearly
aligned.

## Divergent and Agreed can both be true

Predicates are **existential over pairs**, not exclusive aggregates. Example:
agent A writes two findings at one location (near-identical wording + unrelated
wording); agent B matches the first. One cross-agent pair can be Agreed
(\(J = 1\)) and another Divergent (\(J = 0\)) — the group shows under both
tabs. Do not add a mutual-exclusivity tie-break.

## What the filters are not

- **Not severity agreement.** All three agents CRITICAL with dissimilar titles
  can still be Divergent (or soft-band Matched-only).
- **Not clustering by title.** Grouping is coordinates-first; filters only
  classify groups that already exist.
- **Not persisted.** Flags are derived when building the run view; re-tune
  thresholds and the next fetch reclassifies.
