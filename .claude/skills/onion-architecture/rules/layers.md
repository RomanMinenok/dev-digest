# Layer Dependency Rules

## The Dependency Rule

Dependencies flow **inward only**. Each layer may import from layers inside it, never from layers outside it.

```
Domain ← Application ← Infrastructure
Domain ← Application ← Presentation
```

Composition root (`container.ts`) is the only place allowed to import from all layers simultaneously — that is its entire purpose.

## Allowed Imports Per Layer

### Domain (`@devdigest/shared`, `types.ts`)
- `zod` — schema definition only
- TypeScript built-ins
- **Nothing else.** Zero framework imports.

### Application (`service.ts`)
- Domain types and port interfaces
- Other application-layer helpers (`helpers.ts`, `constants.ts` within the same module)
- `platform/errors.ts` — domain-level error types
- **Not allowed:** `drizzle-orm`, `fastify`, `octokit`, `openai`, concrete adapter classes

### Infrastructure (`repository.ts`, `adapters/*`)
- Domain types and port interfaces (to implement them)
- `drizzle-orm` / `postgres` — in repositories only
- External SDKs (`octokit`, `@anthropic-ai/sdk`, `openai`) — in adapters only
- `platform/errors.ts`
- **Not allowed:** `fastify`, sibling module service files

### Presentation (`routes.ts`)
- `fastify` types, `fastify-type-provider-zod`
- `zod` — HTTP request/response schemas
- The module's `service.ts` (one hop outward max)
- `@devdigest/shared` — shared Zod schemas
- `platform/errors.ts`
- **Not allowed:** `drizzle-orm`, concrete repository classes, adapter classes

### Composition root (`platform/container.ts`)
- Everything — this is the only file with full visibility
- Its job is to wire ports to adapters and inject into services

## Import Guard: Quick Mental Model

Before writing an import, ask:
> "Is the thing I'm importing from a **more inner** layer than where I am?"

If yes → allowed.
If no → stop and redesign (extract an interface, pass via DI, or move the logic).

## Cross-Module Imports

Modules (`modules/agents/`, `modules/reviews/`, …) must not import from each other's internal files directly. Cross-module dependencies go through:

1. `platform/container.ts` — the container holds cross-cutting repositories
2. `@devdigest/shared` — shared contracts

```ts
// BAD — reviews reaching into agents' internals
import { AgentsRepository } from '../agents/repository.js';

// GOOD — use the container's shared repo
const agents = container.agentsRepo;
```
