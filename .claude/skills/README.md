# Skills

> Catalog version: v1.1.0

Reusable AI skills that provide specialized knowledge and workflows. Canonical location is `.claude/skills/` with a symlink at `.cursor/skills/ → ../.claude/skills` for Cursor compatibility. Shared with the team via version control.

## Catalog

| Skill | Version | Scope | Description |
|-------|---------|-------|-------------|
| [onion-architecture](onion-architecture/SKILL.md) | 1.0.0 | Backend | Enforces Onion Architecture for new server modules — layer rules, Fastify/Drizzle/Zod placement, DI container, anti-patterns |
| [fastify-best-practices](fastify-best-practices/SKILL.md) | — | Backend | Fastify routes, plugins, JSON-schema validation, error handling |
| [drizzle-orm-patterns](drizzle-orm-patterns/SKILL.md) | — | Backend | Drizzle schema, queries, relations, transactions, migrations |
| [postgresql-table-design](postgresql-table-design/SKILL.md) | — | Backend | Postgres schema design, data types, indexing, constraints |
| [next-best-practices](next-best-practices/SKILL.md) | — | Frontend | Next.js App Router, RSC boundaries, data fetching, optimization |
| [react-best-practices](react-best-practices/SKILL.md) | — | Frontend | React anti-patterns, state management, hooks rules |
| [react-component-architecture](react-component-architecture/SKILL.md) | — | Frontend | Component decomposition, file layout, constants/utils/hooks co-location, TypeScript prop patterns (Next.js 15 + Mantine) |
| [react-testing-library](react-testing-library/SKILL.md) | — | Frontend | General-purpose React Testing Library guide with Vitest |
| [zod](zod/SKILL.md) | — | Full-stack | Zod schema validation, parsing, error handling, type inference |
| [typescript-expert](typescript-expert/SKILL.md) | — | Full-stack | Type-level programming, performance, tooling, migrations |
| [security](security/SKILL.md) | — | Full-stack | OWASP Top 10:2025, auth, injection, uploads, secrets |
| [mermaid-diagram](mermaid-diagram/SKILL.md) | — | Shared | Mermaid diagrams in markdown (flowcharts, sequence, ERD, …) |
| [engineering-insights](engineering-insights/SKILL.md) | — | Workflow | Capture session learnings into each module's `INSIGHTS.md` (append-only, 7 sections) |
| [pr-self-review](pr-self-review/SKILL.md) | 1.0.0 | Workflow | Pre-PR gate: type-check, secrets scan, per-file skill review (UI → frontend skills, backend → backend skills), blocks on CRITICAL findings |
| [implement-plan](implement-plan/SKILL.md) | 1.0.0 | Workflow | SDD Implement→Verify→Review orchestrator: runs `implementer` in dependency-ordered parallel waves, merges each into an integration branch, runs `plan-verifier` + `architecture-reviewer` with a capped auto-fix loop. Never runs spec-creator/implementation-planner/test-writer. |

## What Are Skills?

Skills are modular packages that extend the AI agent with specialized knowledge and workflows. Unlike rules (always applied) or agents (invoked for specific tasks), skills are loaded on-demand when the agent determines they're relevant.

### Skills vs Rules vs Commands vs Agents

| Type | Scope | Loaded | Purpose |
|------|-------|--------|---------|
| **Rules** (`.mdc`) | Project conventions | Always or by file pattern | Persistent guardrails |
| **Commands** (`.md`) | User actions | On `/command` invocation | Slash commands |
| **Skills** (`.md`) | Domain knowledge | On-demand by agent | Specialized knowledge |
| **Agents** (`.md`) | Workflows | Via Task tool | Subagent orchestration |

## Creating New Skills

Each skill has:

- `SKILL.md` — Main skill file with rules and conventions (required)
- `examples.md` — Code examples showing good/bad patterns (recommended)
- `references.md` — Sources and rationale (optional)
