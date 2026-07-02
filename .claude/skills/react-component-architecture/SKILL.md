---
name: react-component-architecture
description: "Structural and organizational decisions for React components in this project (Next.js 15 + Mantine). Use when deciding how to split components, where to put constants/utils/styles/hooks, how to separate business logic, or how to organize a new feature folder. Covers decomposition rules, file layout, co-location, TypeScript prop patterns. Complements react-best-practices (which covers API misuse rules) and next-best-practices (which covers App Router / RSC specifics)."
metadata:
  tags: react, architecture, components, structure, organization, typescript, mantine, next-js
  version: "1.0.0"
---

# React Component Architecture

Structural decisions for `client/src/` in this project (Next.js 15 + Mantine + TypeScript).

## Severity Levels

- **CRITICAL** — Wrong structure will cause coupling, circular imports, or maintainability collapse
- **HIGH** — Wrong choice will create hidden bugs or make the code hard to change
- **MEDIUM** — Affects developer experience and consistency

## Related Skills

| Skill | What It Covers | When to Use Instead |
|-------|----------------|---------------------|
| `react-best-practices` | React API misuse: hooks rules, state anti-patterns, render bugs | You're reviewing component logic, not structure |
| `next-best-practices` | App Router, RSC boundaries, data fetching patterns | You're working with `page.tsx`, layouts, or server components |
| `typescript-expert` | Advanced TypeScript: generics, conditional types, tooling | You need type-level programming beyond prop shapes |

---

## Feature Folder Structure (CRITICAL)

Every feature component lives in its own folder. The folder is the encapsulation unit.

```
components/<feature>/
  ComponentName.tsx   ← main component file, PascalCase matches folder name
  constants.ts        ← magic values, enums, thresholds
  helpers.ts          ← pure functions used by the component
  styles.ts           ← co-located CSSProperties objects (Mantine / inline styles)
  hooks/              ← hooks subfolder when there are 2+ hooks
    useFeatureThing.ts
    index.ts
  SubPart/            ← sub-components get their own subfolder
    SubPart.tsx
    index.ts
  index.ts            ← public barrel: re-exports the main component only
```

Rules:
- The folder name is the feature name (camelCase). The file name is PascalCase.
- `index.ts` **only re-exports the main component** — never leak internals through it.
- Route-local components live in `app/<route>/_components/` — promote to `src/components/` only when reused in a second route.
- Shared components used by 3+ features go in `src/components/` at the top level.

## Where Code Lives — Decision Matrix (CRITICAL)

| Code type | Location |
|-----------|----------|
| Magic numbers, regex, thresholds, label strings | `components/<feature>/constants.ts` |
| Pure functions: parsing, formatting, sorting | `components/<feature>/helpers.ts` |
| CSSProperties objects, Mantine style props | `components/<feature>/styles.ts` |
| Hooks specific to one feature | `components/<feature>/hooks/useX.ts` |
| Shared hooks used by 2+ features | `src/lib/hooks/<domain>.ts` |
| All API calls to the server | `src/lib/api.ts` ONLY — never scatter fetch calls |
| Shared types | `src/lib/types.ts` or domain-specific type in `hooks/<domain>.ts` |
| Mantine theme overrides | `src/lib/theme.tsx` |
| Providers / context | `src/lib/providers.tsx` or `src/lib/<name>-context.tsx` |

## Business Logic → Hooks, Not Components (CRITICAL)

A component body must only: compute display values, map state to JSX, and call handlers.
Everything else belongs in a custom hook.

Extract to a hook when:
- The logic involves `useEffect`, `useMemo`, or `useReducer`
- The logic manages >1 related state variables
- The logic is testable independently of rendering
- The logic would repeat across 2+ components

Hook files (`use<Name>.ts`) must:
- Live in the component's `hooks/` subfolder (feature-scoped) or `src/lib/hooks/` (shared)
- Export one default hook per file
- Type the return value explicitly with a named interface
- Use `@tanstack/react-query` for server state (`useQuery`, `useMutation`) — see `src/lib/hooks/reviews.ts`

## Constants in Separate Files (HIGH)

Extract to `constants.ts` when:
- A value is used in more than one place within the component
- A value has a non-obvious meaning (threshold, timeout, regex)
- A value may change independently of component logic

Keep inline when:
- It's a one-off literal used exactly once and the meaning is obvious from context
- It's a JSX string that is clearly UI copy

Naming conventions:
```ts
// SCREAMING_SNAKE_CASE for module-level constants
export const AUTO_EXPAND_MAX_LINES = 200;
export const HUNK_HEADER_RE = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
export const G_NAV_TIMEOUT_MS = 800;
```

## Styles in Separate Files (MEDIUM)

This project uses `satisfies CSSProperties` objects extracted to `styles.ts`:

```ts
// styles.ts
import type { CSSProperties } from "react";
export const s = {
  list: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  header: { padding: "10px 12px", cursor: "pointer" } satisfies CSSProperties,
} as const;
```

Rules:
- Name the export `s` for brevity (used as `s.list`, `s.header` in JSX)
- Dynamic styles (depending on props/state) → export as small pure functions in `styles.ts`, not inline
- Never inline `style={{}}` objects in JSX — they create a new object reference on every render

## Helpers (Pure Utils) vs Hooks (MEDIUM)

| `helpers.ts` | `hooks/useX.ts` |
|---|---|
| No React imports | Uses `useState`, `useEffect`, etc. |
| Pure functions: input → output | May have side effects / subscriptions |
| Synchronous | May be async |
| Testable without React Testing Library | Needs `renderHook` to test |

Do not put business logic in `helpers.ts` — it is for transformation and formatting only.
Do not put React state or effects in `helpers.ts`.

## Component Decomposition — When to Split (HIGH)

Split a component into sub-components when ANY of these is true:
- The component exceeds ~150 lines
- A section of JSX can be named meaningfully on its own
- A section has its own local state
- The same JSX block appears more than once

Sub-components go in their own `SubName/SubName.tsx` subfolder within the feature folder.

**Container / Presenter split** (mandatory for data-fetching components):
- Container = fetches data via hooks, handles loading/error/empty states, renders nothing visual
- Presenter = receives typed props, renders UI, has no hooks except formatting helpers

```tsx
// PrDetail.tsx (container) — fetches, guards
const { data, isLoading, error } = usePrReviews(prId);
if (isLoading) return <Loader />;
if (error) return <ErrorState />;
return <PrDetailView reviews={data} />;

// PrDetailView.tsx (presenter) — only renders
interface PrDetailViewProps { reviews: ReviewRecord[] }
function PrDetailView({ reviews }: PrDetailViewProps) { ... }
```

## TypeScript Prop Patterns (HIGH)

### Prop interface naming
```ts
// Always name the interface <ComponentName>Props — no anonymous types in JSX
interface DiffViewerProps {
  files: FileDiff[];
  onFileClick?: (path: string) => void;
}
```

### Discriminated unions for variant components
```ts
// BAD: optional props that are only valid together
interface BadProps {
  mode?: 'view' | 'edit';
  onSave?: () => void;  // only makes sense in edit mode
}

// GOOD: discriminated union enforces consistency at compile time
type GoodProps =
  | { mode: 'view' }
  | { mode: 'edit'; onSave: () => void };
```

### Avoid prop explosion
- More than 5-6 props → either the component does too much, or group related props into a sub-object
- Prefer accepting a domain object (`review: ReviewRecord`) over 6 individual fields

## API Layer (CRITICAL)

All server calls go through `src/lib/api.ts`. Never import `fetch` or `axios` directly in a component or hook — call `api.get()`, `api.post()`, `api.del()`.

- React Query hooks (`useQuery`, `useMutation`) are the standard wrapper — see `src/lib/hooks/reviews.ts`
- `queryKey` arrays must be `["resource-type", id]` — consistent so `invalidateQueries` works
- SSE streams use `EventSource` directly inside `useEffect` in a hook (not in a component)

## File Order Convention (MEDIUM)

Within any `.tsx` or `.ts` file:
1. `"use client"` directive (if needed)
2. External imports (react, next, mantine, tanstack)
3. Internal imports (`@devdigest/`, `../lib/`, `./helpers`)
4. Types / interfaces
5. Module-level constants
6. Component(s) or hook(s)
7. Named exports (no default exports for components — use named)

---

## Sources

See [README.md](README.md) for the sources table and [references.md](references.md) for the full annotated list.
