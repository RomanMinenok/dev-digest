# Presentation Layer — routes.ts

The presentation layer translates HTTP into application layer calls and back. It knows about Fastify, HTTP verbs, status codes, and Zod schemas for request/response shapes. It knows nothing about databases or external APIs.

## Structure

```ts
// modules/feature/routes.ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { FeatureContract } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { FeatureService } from './service.js';

export default async function featureRoutes(app: FastifyInstance) {
  const svc = new FeatureService(app.container);

  app.withTypeProvider<ZodTypeProvider>().get(
    '/features',
    {
      schema: {
        response: { 200: z.array(FeatureContract) },
      },
    },
    async (req, reply) => {
      const { workspaceId } = getContext(req);
      return svc.list(workspaceId);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/features',
    {
      schema: {
        body: CreateFeatureBody,
        response: { 201: FeatureContract },
      },
    },
    async (req, reply) => {
      const { workspaceId } = getContext(req);
      const feature = await svc.create(workspaceId, req.body);
      return reply.code(201).send(feature);
    },
  );
}
```

## Responsibilities

- Define Zod schemas for HTTP **request** bodies and **response** shapes inline or import from `@devdigest/shared`
- Extract `workspaceId` via `getContext(req)` — never trust raw `req.params` for workspace scoping
- Map HTTP inputs to `service.ts` input types (name remapping, coercion)
- Handle `NotFoundError` → 404 by letting Fastify's error handler propagate it (no manual `reply.code(404)`)
- Return domain DTOs directly — Fastify serializes via the Zod response schema

## Zod Schema Placement

| Schema type | Where to define |
|-------------|-----------------|
| Response contract (shared with client) | `@devdigest/shared` |
| Request body (HTTP-only) | inline in `routes.ts` |
| Reusable param shapes (`IdParams`) | `modules/_shared/schemas.ts` |

## Rules

- `routes.ts` imports only: `service.ts`, `@devdigest/shared`, `modules/_shared/`, `platform/errors.ts`, `fastify`, `zod`
- Never import `drizzle-orm`, repository classes, or adapter classes in `routes.ts`
- Never construct `new FeatureRepository(...)` in a route — only `new FeatureService(app.container)`
- Use `fastify-type-provider-zod` for all routes — no `ajv`/JSON Schema
- SSE routes live in `routes.ts` using `fastify-sse-v2`; the event bus is on `container.runBus`
- Middleware (auth guards, rate limit) is registered as Fastify hooks, not inline in handlers
