# Agents

> Custom Claude Code subagents for DevDigest. Each lives as a `.claude/agents/*.md`
> file with YAML frontmatter (`name`, `description`, `tools`, `model`, …) and a
> system-prompt body. They are invoked via the `Agent` tool (`subagent_type`) or
> proactively delegated based on their `description`. Checked into version control
> so the whole team shares them.

## Catalog

| Agent | Model | Tools | Role |
| --- | --- | --- | --- |
| [spec-creator](spec-creator.md) | opus | Read, Grep, Glob, WebSearch, WebFetch, Write, Edit | Writes Spec-Driven Development specs. Interviews the requester with EARS-based clarifying questions (weaving in gaps, edge cases, cross-module concerns, and UX issues found by reading the code and `/design`) before writing anything, then writes exactly one file to `/specs/SPEC-NN-slug.md`. Restricted to `/specs/**` and `/design/**` — cannot touch application code. |
| [researcher](researcher.md) | sonnet | Read, Grep, Glob, WebSearch, WebFetch | Read-only investigator — finds facts in the codebase or on the web and returns a strictly structured, honest report. Never modifies anything. |
| [implementation-planner](implementation-planner.md) | opus | Read, Grep, Glob, WebSearch, WebFetch | Read-only architect — produces a structured **Implementation Plan** before non-trivial coding, never a specification. Checks requirements for completeness, asks multi-agent vs. single-agent execution mode, maps modules, applies Onion architecture, reads INSIGHTS.md, and breaks work into tasks that each name the skills the implementer must load. |
| [implementer](implementer.md) | sonnet · worktree isolation optional | Read, Edit, Write, Bash, Grep, Glob, Skill | Executes **one** plan task (backend or UI); runs in the current working tree by default, or in its own git worktree if the orchestrator opts into isolation for parallel runs. Loads domain-specific skills, iterates until the touched package's *existing* tests + type-check pass. Never writes tests. Self-review is limited to the code it wrote. |
| [test-writer](test-writer.md) | sonnet · `isolation: worktree` | Read, Edit, Write, Bash, Grep, Glob, Skill | Writes/extends tests (backend or UI) for a scoped change. Reads `TESTING.md` + INSIGHTS first, follows repo test conventions and the typological philosophy, tests behaviour at the seams, then runs the suite and iterates until green — showing real output. Does not write production code. |
| [architecture-reviewer](architecture-reviewer.md) | opus | Read, Grep, Glob, Bash *(read-only)* | Read-only **architectural** review — structure, not lines. Checks the Onion dependency rule, layer boundaries, coupling/cohesion, cycles, anemic domain, leaky ports. Findings by severity + confidence, each anchored to `path:line`. Never edits. |
| [plan-verifier](plan-verifier.md) | opus | Read, Grep, Glob, Bash *(read-only)* | Read-only **completeness** audit — verifies every plan/requirement item is actually built. Builds a requirement→`path:line` traceability matrix (Implemented / Partial / Missing / Cannot-verify) and reports gaps honestly. Not a quality reviewer. |
| [doc-writer](doc-writer.md) | sonnet | Read, Edit, Write, Grep, Glob | Turns existing material into documentation — documents built functionality, converts plans into docs, produces structured docs with Mermaid diagrams. Evidence-based (cites `path:line`), applies Diátaxis, routes each doc to its correct home. Docs only; never edits source. |

## The full lifecycle

The agents cover a **Spec → Plan → Implement → Test → Verify → Review → Document** loop.
Each stage is a focused, single-responsibility agent with least-privilege tools;
compose only the stages a given change needs.

```mermaid
flowchart LR
  S[spec-creator<br/>spec] --> P
  R[researcher<br/>read-only] -.facts.-> P
  P[implementation-planner<br/>plan] --> I[implementer<br/>code]
  I --> T[test-writer<br/>tests]
  T --> V[plan-verifier<br/>completeness]
  V --> A[architecture-reviewer<br/>structure]
  A --> D[doc-writer<br/>docs]
```

- **Write agents** (touch files): `spec-creator` (writes only `/specs/**` and
  `/design/**`, never application code), `implementer` (code), `test-writer`
  (tests), `doc-writer` (docs only). `test-writer` always uses
  `isolation: worktree`; `implementer` runs in the current working tree by
  default and only gets its own worktree when the orchestrator opts into
  isolation for a given run (needed for safe parallel dispatch, skippable in
  sequential mode).
- **Read-only agents** (no Edit/Write): `researcher`, `implementation-planner`,
  `plan-verifier`, `architecture-reviewer`. The two reviewers keep `Bash` but for
  **read-only evidence gathering only** (`tsc`, tests, `git log`) — never
  mutation.
- **Division of labour among the checkers:** `plan-verifier` asks *"was every
  requirement built?"* (completeness), `architecture-reviewer` asks *"is it in
  the right place, dependencies pointing the right way?"* (structure). They
  deliberately don't overlap. **Line-level findings across the whole branch
  (naming, `any`, missing null checks) are not covered by any agent in this
  pipeline** — `implementer`'s Step 5 self-review only covers its own task's
  diff. Optionally run [`pr-self-review`](../skills/pr-self-review/SKILL.md)
  by hand before opening the PR if you want that gate; it is not part of the
  automatic chain below.

## How the two work together

`implementation-planner` and `implementer` form an **orchestrator-workers** pipeline:

1. **Plan** — `implementation-planner` checks the requirements for
   completeness (asking clarifying questions and offering recommendations
   where needed), confirms with the user whether to run multi-agent or
   single-agent, explores the repo (read-only), applies the
   [`onion-architecture`](../skills/onion-architecture/SKILL.md) skill, reads each
   touched module's `INSIGHTS.md`, and emits an Implementation Plan: 15–40 discrete
   tasks, each tagged with its owned files, the skills to load, and (in multi-agent
   mode) a `[P]` marker when it touches files disjoint from other tasks (i.e. safe
   to parallelize).
2. **Implement** — one `implementer` per task. Tasks marked `[P]` can run in
   parallel; each implementer *can* get its own git worktree, if the
   orchestrator opts into worktree isolation for this run, so parallel runs
   can't clobber each other's files on disk (off by default — the
   orchestrator asks before dispatching). Each implementer reads its module's
   local `INSIGHTS.md`, loads the skills the plan assigned, writes the code,
   and loops on tests + `tsc` until green.

The planner deliberately embeds the **full skills matrix**, so every practice the
implementer will apply is decided up front, at planning time.

### Orchestration protocol — waves and merging

Nothing dispatches `implementer`/`test-writer` calls automatically. **The
session that is talking to the user is the orchestrator** — there is no
dedicated orchestrator agent, because merge conflicts and blocked tasks need a
judgment call, not a read-only worker. That session:

1. Parses the plan's `Task breakdown` into a dependency graph from each task's
   `(depends on: ...)`.
2. Groups tasks into **waves**: a wave is the maximal set of tasks whose
   dependencies are already merged. `[P]`-tagged tasks in the same wave are
   dispatched as **multiple `Agent` calls in a single message** (true
   parallelism); a non-`[P]` task is its own wave of one.
3. After a wave's agents return, checks each report's `tsc`/`tests: PASS`
   before proceeding — a reported `FAIL`/`blocked` stops that task's branch
   from being merged.
4. **Merges each task's worktree branch** into the plan's integration branch
   (one `git merge` per task, sequentially) — only applies when worktree
   isolation was used for the run; otherwise implementers already worked
   directly in the integration branch's working tree and there's nothing to
   merge. `[P]` tasks were scoped to disjoint files by the planner, so a merge
   should be clean fast-forward — a real conflict means the plan
   under-scoped `[P]`, not a normal outcome.
5. Only starts the next wave from the updated integration branch.
6. Once all waves are merged, runs `test-writer` for any test-owning tasks,
   then `plan-verifier`, then `architecture-reviewer`, then `doc-writer` — in
   that order (completeness before structure, see above).

### Skills routing (shared by both agents)

Both agents route skills by the files a task touches — the same table the
[`pr-self-review`](../skills/pr-self-review/SKILL.md) gate uses:

| Files touched | Skills |
| --- | --- |
| `server/src/**` (backend logic) | fastify-best-practices, onion-architecture, zod, security, typescript-expert |
| `server/src/db/schema/**`, migrations | postgresql-table-design, drizzle-orm-patterns |
| `server/src/vendor/shared/contracts/**` | zod, typescript-expert |
| `reviewer-core/**` (pure domain) | onion-architecture, typescript-expert |
| `client/**` (UI) | react-best-practices, react-component-architecture, next-best-practices, security, typescript-expert |

`react-testing-library` is not in this shared table — it is loaded only by
`test-writer`, which owns all test authoring (implementer never writes tests;
see "Orchestration protocol" and the plan template's "Tests owned by" field).

### Insights (INSIGHTS.md) flow

- **Planner** reads *all* touched modules' `INSIGHTS.md` at plan time and distils
  the relevant lessons into each task.
- **Implementer** additionally reads *only its own module's* `INSIGHTS.md` in
  place (just-in-time), so no single agent has to load the whole repo's history.

See the [`engineering-insights`](../skills/engineering-insights/SKILL.md) skill for
how those files are produced and consumed.

## What these agents are based on

Both `implementation-planner` and `implementer` were designed against current
Claude Code / Anthropic guidance and a spec-driven-development reference. The
practices they encode:

- **Single responsibility + routing-style `description`.** Each agent does one
  thing; the `description` is written as a "when to delegate" rule. Tools are
  restricted to match the role (planner is read-only; implementer gets code tools).
- **Explore → Plan → Implement → Verify.** The planner produces the plan; the
  implementer's contract is "give it a way to verify its work" — write code, run
  tests/`tsc`, iterate until green, and *show real output as evidence* rather than
  asserting success.
- **Orchestrator-workers + optional parallel isolation.** Work is decomposed
  into discrete, independently verifiable tasks; `[P]` tasks touch disjoint
  files, and the orchestrator can opt each implementer into its own worktree
  (`isolation: worktree`) for a run. Worktrees prevent *file* conflicts when
  enabled; disjoint task scoping (the planner's job) prevents *logical*
  conflicts either way.
- **Conditional Skills loading.** Skills are preloaded via the `skills:` frontmatter
  field *and* routed at runtime in the agent body by file type (backend vs UI), so
  the right domain skills load whether or not a given harness preloads frontmatter.
- **Progressive disclosure for context.** Insights are surfaced as short,
  task-scoped pointers and read just-in-time per module, rather than inlining the
  repo's entire lessons corpus into every agent.

### Sources

- [Create custom subagents](https://code.claude.com/docs/en/sub-agents) — Claude
  Code docs (official). Frontmatter schema; "design focused subagents / write
  detailed descriptions / limit tool access"; `skills:` preloading; fresh isolated
  context per subagent.
- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices) —
  Claude Code docs (official). Explore→Plan→Implement→Commit workflow; "give Claude
  a way to verify its work"; adversarial/self-review; CLAUDE.md-vs-Skills split.
- [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees) —
  Claude Code docs (official). `isolation: worktree` mechanism for parallel
  subagents; auto-cleanup; file-vs-logical conflict distinction.
- [Building Effective AI Agents](https://www.anthropic.com/engineering/building-effective-agents) —
  Anthropic engineering blog (official). Orchestrator-workers and
  evaluator-optimizer patterns; "keep it simple" design philosophy.
- [Agent Skills — authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) —
  Claude docs (official). Progressive disclosure; description-driven discovery;
  domain-partitioned reference material; references one level deep.
- [GitHub spec-kit — spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md) —
  GitHub (primary source, third-party). Spec → Plan → Tasks → Implement structure;
  15–40 discrete tasks with "done-when" criteria; `[P]` parallelizable tagging.

The lifecycle agents (`test-writer`, `architecture-reviewer`, `plan-verifier`,
`doc-writer`) add these references:

- [Testing Library — Guiding Principles](https://testing-library.com/docs/guiding-principles/)
  & [Kent C. Dodds — Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details) —
  official / author. "Tests should resemble how the software is used"; test
  behaviour, not internals; query priority (`getByRole` → … → `getByTestId`).
  Backs `test-writer`, alongside the repo's own `TESTING.md` (typological, mock
  the outside world) and [Fastify — Testing](https://fastify.dev/docs/latest/Guides/Testing/)
  (`fastify.inject()`).
- [Martin Fowler — TestCoverage](https://martinfowler.com/bliki/TestCoverage.html) —
  primary. Coverage is a find-the-gaps tool, not a quality metric — `test-writer`
  writes meaningful tests, not coverage-chasing ones.
- [Robert C. Martin — The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html),
  [Alistair Cockburn — Hexagonal](https://alistair.cockburn.us/hexagonal-architecture),
  [Martin Fowler — AnemicDomainModel](https://martinfowler.com/bliki/AnemicDomainModel.html) —
  primary. The Dependency Rule, ports/adapters, and rich-vs-anemic domain — the
  checklist `architecture-reviewer` applies (findings by severity + confidence,
  evidence-anchored).
- [Diátaxis](https://diataxis.fr/) &
  [GitHub — Mermaid in Markdown](https://github.blog/developer-skills/github/include-diagrams-markdown-files-mermaid/),
  plus [ADR (Fowler bliki)](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html) —
  official / primary. Doc-type split, diagrams-as-code, and the `docs/adr/`
  Context→Decision→Consequences convention — the practices `doc-writer` follows.
- [Anthropic — Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) —
  official. The evaluator-optimizer pattern and "evidence over assertion" behind
  `plan-verifier`'s requirement-traceability audit (requirements → `path:line` →
  status), which deliberately reports gaps rather than rubber-stamping.

> `researcher` predates this research pass but follows the same read-only,
> evidence-over-assertion, structured-report principles the whole roster shares.
