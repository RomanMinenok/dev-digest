# Application Layer — service.ts

The application layer orchestrates domain objects and port interfaces to fulfil use cases. It knows **what** needs to happen; the infrastructure layer handles **how**.

## Responsibilities

- Implement one use case per public method (`list`, `get`, `create`, `update`, `delete`, orchestration methods)
- Call port interfaces (repositories, adapters) — never concrete implementations
- Map raw DB rows to domain DTOs (`toAgentDto`, `toFindingDto`, …)
- Enforce domain invariants and throw domain errors (`NotFoundError`, `ConflictError`)
- Never deal with HTTP status codes, request objects, or Drizzle query builders

## Constructor Pattern

The service receives the `Container` as its sole constructor argument. It resolves what it needs from the container lazily or eagerly — never by importing adapter classes directly.

```ts
// modules/feature/service.ts
import type { Container } from '../../platform/container.js';
import type { FeatureEntity } from '@devdigest/shared';
import { FeatureRepository } from './repository.js';
import { NotFoundError } from '../../platform/errors.js';

export class FeatureService {
  private repo: FeatureRepository;

  constructor(private container: Container) {
    this.repo = new FeatureRepository(container.db);
  }

  async list(workspaceId: string): Promise<FeatureEntity[]> {
    const rows = await this.repo.list(workspaceId);
    return rows.map(toFeatureDto);
  }

  async get(workspaceId: string, id: string): Promise<FeatureEntity> {
    const row = await this.repo.getById(workspaceId, id);
    if (!row) throw new NotFoundError('Feature', id);
    return toFeatureDto(row);
  }
}
```

## Input / Output Types

Define `CreateFeatureInput` and `UpdateFeatureInput` interfaces inside `service.ts`. These are the application layer's own types — they may differ from the HTTP body (the route maps HTTP → input, the service maps input → DB).

```ts
export interface CreateFeatureInput {
  name: string;
  config?: unknown;
}
```

## Rules

- Services import `repository.ts` to construct the repo, but only call it through its public interface (no raw Drizzle inside `service.ts`)
- When a service needs an adapter (LLM, GitHub), it gets it from `container.llm(provider)` or similar — never `new OpenAIProvider(...)`
- Map DB rows to domain types inside the service (or in `helpers.ts`); never leak `$inferSelect` types to routes
- Throw domain errors from `platform/errors.ts`; the Fastify error handler in `app.ts` maps them to HTTP status codes
- A service method = one use case. Keep them focused; extract helpers to `helpers.ts` if they grow
