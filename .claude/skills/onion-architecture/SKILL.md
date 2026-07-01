---
name: onion-architecture
version: 1.0.0
description: "Enforces Onion Architecture for new backend modules in @devdigest/api. Use when scaffolding a new server module, adding a feature to an existing one, deciding where a piece of logic belongs, or reviewing cross-layer dependencies. Maps the four layers (Domain → Application → Infrastructure → Presentation) to the project's concrete tools: Zod contracts, service.ts, Drizzle repository.ts, Fastify routes.ts, and platform/container.ts as the composition root. Trigger terms: new module, backend feature, where does this code go, layer boundary, onion, clean architecture, ports and adapters, repository pattern, use case, application service."
metadata:
  tags: architecture, backend, onion, clean-architecture, fastify, drizzle, zod, typescript, ddd
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Onion Architecture — @devdigest/api

> Version 1.0.0

The server follows **Onion Architecture** (also called Ports & Adapters / Hexagonal Architecture):
dependencies always point **inward**. Outer layers know about inner layers; inner layers know nothing about outer layers.

```
┌─────────────────────────────────────────────────┐
│  Presentation  (routes.ts — Fastify)            │  ← outermost
│  ┌───────────────────────────────────────────┐  │
│  │  Infrastructure  (repository.ts — Drizzle │  │
│  │                   adapters/ — LLM, GitHub)│  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  Application  (service.ts)          │  │  │
│  │  │  ┌───────────────────────────────┐  │  │  │
│  │  │  │  Domain  (@devdigest/shared   │  │  │  │
│  │  │  │          Zod contracts +      │  │  │  │
│  │  │  │          port interfaces)     │  │  │  │
│  │  │  └───────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         platform/container.ts = composition root
```

## Layer → File Mapping

| Layer | File(s) | Tools |
|-------|---------|-------|
| **Domain** | `@devdigest/shared` contracts, `types.ts` | Zod, TypeScript types |
| **Application** | `modules/<feature>/service.ts` | Pure TypeScript |
| **Infrastructure** | `modules/<feature>/repository.ts`, `adapters/*` | Drizzle ORM, Octokit, OpenAI SDK |
| **Presentation** | `modules/<feature>/routes.ts` | Fastify, Zod (HTTP validation) |
| **Composition root** | `platform/container.ts` | DI wiring only |

## The Golden Rule

```
routes.ts → service.ts → port interface → repository.ts / adapter
```

No arrow ever points outward. If you find yourself importing `fastify` inside a service, or `drizzle-orm` inside a route, a layer boundary has been crossed.

## Recommended Reading

- [rules/layers.md](rules/layers.md) — dependency rules and import guards
- [rules/domain-layer.md](rules/domain-layer.md) — entities, Zod contracts, port interfaces
- [rules/application-layer.md](rules/application-layer.md) — service.ts patterns (use cases)
- [rules/infrastructure-layer.md](rules/infrastructure-layer.md) — Drizzle repository, adapters
- [rules/presentation-layer.md](rules/presentation-layer.md) — Fastify routes, Zod HTTP validation
- [rules/di-container.md](rules/di-container.md) — composition root, ContainerOverrides for tests
- [rules/anti-patterns.md](rules/anti-patterns.md) — what NOT to do and why
- [README.md](README.md) — all sources: project files inspected + external references

## New Module Checklist

When scaffolding `modules/<feature>/`:

- [ ] Define domain types/contracts in `@devdigest/shared` or a local `types.ts`
- [ ] Write port interface(s) the service depends on (e.g. `IFeatureRepository`)
- [ ] Implement `service.ts` depending only on port interfaces + domain types
- [ ] Implement `repository.ts` implementing the port interface using Drizzle
- [ ] Register the repository on `Container` in `platform/container.ts`
- [ ] Implement `routes.ts` importing only from `service.ts` and `@devdigest/shared`
- [ ] Run `pnpm typecheck` — zero cross-layer leakage = passes
