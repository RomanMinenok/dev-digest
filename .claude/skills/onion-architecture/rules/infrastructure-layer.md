# Infrastructure Layer — repository.ts & adapters/

The infrastructure layer implements the port interfaces defined in the domain. It is the only layer permitted to talk to databases, external HTTP APIs, the filesystem, or any I/O sink.

## repository.ts — Drizzle Data Access

The repository owns all Drizzle query builder code for its module's tables. Nothing else in the module touches `drizzle-orm` imports or schema tables directly.

### Structure

```ts
// modules/feature/repository.ts
import { eq, and, desc } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { FeatureRow } from '../../db/rows.js';

export interface InsertFeature {
  workspaceId: string;
  name: string;
  config?: unknown;
}

export class FeatureRepository {
  constructor(private db: Db) {}

  async list(workspaceId: string): Promise<FeatureRow[]> {
    return this.db.select().from(t.features).where(eq(t.features.workspaceId, workspaceId));
  }

  async getById(workspaceId: string, id: string): Promise<FeatureRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.features)
      .where(and(eq(t.features.workspaceId, workspaceId), eq(t.features.id, id)));
    return row;
  }

  async insert(data: InsertFeature): Promise<FeatureRow> {
    const [row] = await this.db.insert(t.features).values(data).returning();
    return row;
  }
}
```

### Rules for repository.ts

- Return raw DB row types (`FeatureRow` = `typeof t.features.$inferSelect`) — never domain DTOs
- Workspace-scope every query: every method receives `workspaceId` and filters by it
- Keep queries in the repository; no Drizzle in `service.ts`
- Cross-entity repositories (those that JOIN across module boundaries, like `AgentsRepository` and `ReviewRepository`) live on `Container` directly, not inside a module folder
- Never throw HTTP errors — only throw plain JS errors or domain errors

## adapters/ — External Integrations

Each adapter in `server/src/adapters/` implements an interface from `@devdigest/shared`:

```
adapters/
  auth/local.ts          → implements AuthProvider
  github/octokit.ts      → implements GitHubClient
  git/simple-git.ts      → implements GitClient
  llm/openai.ts          → implements LLMProvider
  llm/anthropic.ts       → implements LLMProvider
  embedder/openai.ts     → implements Embedder
  codeindex/ripgrep.ts   → implements CodeIndex
```

### Rules for adapters/

- One file per provider/technology (not one file per use case)
- Implement the interface fully — callers only ever see the interface type, never the concrete class
- Configuration and secrets come from the `Container` / `SecretsProvider`, never from `process.env` directly inside an adapter
- Adapters may throw domain errors (`platform/errors.ts`) but not Fastify HTTP errors

## Schema Changes

Database schema lives in `server/src/db/schema/*.ts`. To add a column or table:

1. Edit the schema file
2. `pnpm db:generate` — creates a migration in `src/db/migrations/`
3. `pnpm db:migrate` — applies it
4. **Never hand-edit migration files**
