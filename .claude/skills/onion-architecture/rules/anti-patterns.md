# Anti-Patterns

Violations of the Onion Architecture dependency rule. Each one breaks testability, makes refactoring painful, or leaks infrastructure details into business logic.

---

## 1. Drizzle in service.ts

```ts
// BAD — infrastructure (Drizzle) leaks into application layer
import { eq } from 'drizzle-orm';
import * as t from '../../db/schema.js';

export class FeatureService {
  constructor(private db: Db) {}

  async list(workspaceId: string) {
    return this.db.select().from(t.features).where(eq(t.features.workspaceId, workspaceId));
  }
}

// GOOD — service depends on a repository (port)
export class FeatureService {
  private repo: FeatureRepository;
  constructor(container: Container) {
    this.repo = new FeatureRepository(container.db);
  }
  async list(workspaceId: string) {
    return (await this.repo.list(workspaceId)).map(toFeatureDto);
  }
}
```

---

## 2. FastifyRequest / FastifyReply in service.ts

```ts
// BAD — service knows about HTTP
import type { FastifyRequest } from 'fastify';

export class FeatureService {
  async create(req: FastifyRequest) { … }
}

// GOOD — service takes domain input types
export class FeatureService {
  async create(workspaceId: string, input: CreateFeatureInput) { … }
}
```

---

## 3. Direct repository import across module boundaries

```ts
// BAD — reviews module reaching into agents' folder
// modules/reviews/service.ts
import { AgentsRepository } from '../agents/repository.js';

// GOOD — use the shared cross-cutting repo on the container
const agents = container.agentsRepo;
```

---

## 4. Concrete adapter constructed in service.ts

```ts
// BAD — service hardcodes the LLM provider
import { OpenAIProvider } from '../../adapters/llm/openai.js';

export class ReviewService {
  private llm = new OpenAIProvider(process.env.OPENAI_API_KEY!);
}

// GOOD — get it from container (resolves key lazily, supports overrides)
export class ReviewService {
  async run(provider: Provider) {
    const llm = await this.container.llm(provider);
    …
  }
}
```

---

## 5. Leaking DB row types (`$inferSelect`) to routes

```ts
// BAD — route returns raw Drizzle row
app.get('/features/:id', async (req) => {
  const row = await repo.getById(req.params.id);
  return row; // exposes internal column names, nullable fields, etc.
});

// GOOD — service maps to DTO before it reaches the route
app.get('/features/:id', async (req) => {
  return svc.get(workspaceId, req.params.id); // returns FeatureEntity (domain type)
});
```

---

## 6. process.env inside an adapter

```ts
// BAD — adapter reads env directly (untestable without env manipulation)
export class MyAdapter {
  constructor() {
    this.key = process.env.MY_API_KEY!;
  }
}

// GOOD — key injected by the container
export class MyAdapter {
  constructor(private key: string) {}
}
// container.ts: new MyAdapter(await this.secrets.get('MY_API_KEY'))
```

---

## 7. HTTP status codes in service.ts

```ts
// BAD
if (!row) return reply.code(404).send({ error: 'not found' });

// GOOD — throw a domain error; Fastify error handler maps it
if (!row) throw new NotFoundError('Feature', id);
```

---

## 8. Business logic in routes.ts

```ts
// BAD — pagination logic, validation beyond input parsing, branching
app.get('/features', async (req) => {
  const features = await repo.list(workspaceId);
  const filtered = features.filter(f => f.enabled && f.createdAt > cutoff);
  return filtered.slice(req.query.offset, req.query.offset + req.query.limit);
});

// GOOD — route delegates; service decides
app.get('/features', async (req) => {
  return svc.listEnabled(workspaceId, req.query);
});
```
