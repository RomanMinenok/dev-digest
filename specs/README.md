# Specs

Specifications for Spec-Driven Development. Every spec — whether it belongs
to a single module (`server`, `client`, `reviewer-core`, `e2e`) or spans
several — lives flatly in this one folder. There are no per-module
subfolders.

## Naming

`SPEC-NN-<kebab-case-slug>.md`, e.g. `SPEC-01-pr-blast-radius.md`.

## Numbering

The **Spec ID is `SPEC-NN-<slug>`** — the feature slug is always part of
the ID, not just the filename; the number alone is never used as the ID.
`NN` is a single project-wide counter, not per-module: the next number is
`max(existing SPEC-NN in this folder) + 1`, zero-padded to 2 digits.

## Status

Each spec's header carries `Status: draft | approved | implemented` and an
`Affected modules` line (`server | client | reviewer-core | e2e |
cross-module`).

## Verification hints

Every acceptance criterion and non-functional criterion ends with a short
`(Verify: …)` note naming how it would be checked (test type, manual check,
or measurement) — not a full test plan.

## Diagrams & contracts

Specs may include mermaid diagrams (workflows, cross-service communication)
and data-contract shapes (field/type tables), woven into whatever section
they clarify — never implementation code.

## Lifecycle

Specs are written by the [`spec-creator`](../.claude/agents/spec-creator.md)
subagent, which interviews the requester with EARS-based clarifying
questions before writing anything, and are consumed by
[`implementation-planner`](../.claude/agents/implementation-planner.md) to
produce an Implementation Plan. See
`.claude/agents/README.md` for the full agent lifecycle.

Reference design material used while writing a spec lives in
[`/design`](../design/README.md).
