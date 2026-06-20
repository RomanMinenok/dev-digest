# Domain Layer

The innermost layer. Contains the **language of the business** — no I/O, no framework, no infrastructure concern.

## What Lives Here

| Artifact | Location | Example |
|----------|----------|---------|
| Entity types | `@devdigest/shared` or `modules/<feature>/types.ts` | `Agent`, `ReviewRun`, `Finding` |
| Value objects | same | `Severity`, `Provider`, `ReviewStrategy` (Zod enums) |
| Zod contracts | `server/src/vendor/shared/contracts/` | request/response shapes used by both layers |
| Port interfaces | `modules/<feature>/types.ts` or `@devdigest/shared` | `IFeatureRepository`, `LLMProvider` |
| Domain errors | `platform/errors.ts` | `NotFoundError`, `ConflictError` |

## Defining a Port Interface

A **port** is a TypeScript interface that defines what the application layer needs from the outside world. The infrastructure layer provides a concrete implementation.

```ts
// modules/notifications/types.ts — domain layer
export interface INotificationSender {
  send(to: string, message: string): Promise<void>;
}
```

The application service depends on `INotificationSender`, not on any concrete mailer.

## Zod as the Domain Language

Zod schemas in `@devdigest/shared` ARE the domain model. They define canonical shapes that both the service layer and HTTP layer validate against. Keep them framework-agnostic:

```ts
// vendor/shared/contracts/findings.ts
import { z } from 'zod';

export const Severity = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type Severity = z.infer<typeof Severity>;

export const Finding = z.object({
  id: z.string().uuid(),
  severity: Severity,
  message: z.string(),
});
export type Finding = z.infer<typeof Finding>;
```

## Rules

- Domain types must not import from Drizzle, Fastify, OpenAI SDK, or any adapter
- Zod schemas that cross the HTTP boundary belong in `@devdigest/shared`; schemas used only internally can live in `modules/<feature>/schemas.ts`
- Enums go through Zod (`z.enum([...])`) so they're validated at both DB and HTTP boundaries
- Domain errors (`platform/errors.ts`) are the only "framework" concept allowed — they are Fastify-aware only at the presentation layer where they get mapped to HTTP status codes
