# Onion Architecture — Sources

## Project files this skill was derived from

| File | What it contributed |
|------|---------------------|
| `server/src/modules/agents/service.ts` | Application layer pattern: `Container` injection, repo construction, DTO mapping, domain error throwing |
| `server/src/modules/agents/routes.ts` | Presentation layer pattern: `ZodTypeProvider`, inline Zod schemas, `getContext`, single service import |
| `server/src/modules/agents/repository.ts` | Infrastructure layer pattern: Drizzle-only queries, workspace-scoped methods, `InsertAgent` / `UpdateAgent` input interfaces |
| `server/src/platform/container.ts` | Composition root pattern: `ContainerOverrides`, lazy adapter getters, cross-cutting repos on the container |
| `server/CLAUDE.md` | Canonical module layout (`routes.ts` + `service.ts` + `repository.ts`), DI conventions, cross-entity repo rule |
| `server/package.json` | Full dependency list — confirmed which packages belong to which layer |

## Conceptual foundations

| Concept | Source |
|---------|--------|
| Onion Architecture (original) | Jeffrey Palermo — [Part 1](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/) · [Part 2](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-2/) · [Part 3](https://jeffreypalermo.com/2008/08/the-onion-architecture-part-3/) · [Part 4 — 4 Years Later](https://jeffreypalermo.com/2013/08/onion-architecture-part-4-after-four-years/) |
| Ports & Adapters (Hexagonal Architecture) | Alistair Cockburn — [hexagonal-architecture](https://alistair.cockburn.us/hexagonal-architecture/) · [Wikipedia overview](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)) |
| AWS Prescriptive Guidance | [Hexagonal architecture pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html) — cloud-focused Ports & Adapters walkthrough |

## TypeScript / Node.js implementations

| Resource | Why relevant |
|----------|-------------|
| [Implementing the Onion Architecture in Node.js with TypeScript](https://dev.to/remojansen/implementing-the-onion-architecture-in-nodejs-with-typescript-and-inversifyjs-10ad) | Closest match to our stack — TypeScript, layer separation, DI |
| [Clean Node.js Architecture — Khalil Stemmler](https://khalilstemmler.com/articles/enterprise-typescript-nodejs/clean-nodejs-architecture/) | Enterprise TypeScript patterns, repository & use-case layer design |
| [Clean Architecture with TypeScript: DDD, Onion](https://bazaglia.com/clean-architecture-with-typescript-ddd-onion/) | DDD + Onion in TypeScript, port interfaces and DTO mapping |
| [Fastify API with Postgres and Drizzle ORM](https://dev.to/vladimirvovk/fastify-api-with-postgres-and-drizzle-orm-a7j) | Practical Fastify + Drizzle integration — our exact infra layer |
