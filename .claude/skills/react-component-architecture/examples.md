# React Component Architecture — Code Examples

Real patterns from `client/src/` in this project.

---

## Feature Folder Layout

The `diff-viewer` feature is the canonical example:

```
components/diff-viewer/
  DiffViewer/           ← main component in its own subfolder
    DiffViewer.tsx
    index.ts
  FileCard/             ← sub-component in its own subfolder
    FileCard.tsx
    index.ts
  CommentCard/
    CommentCard.tsx
    index.ts
  constants.ts          ← thresholds, regex
  helpers.ts            ← pure parsing functions
  styles.ts             ← CSSProperties objects
  index.ts              ← public barrel: export { DiffViewer } from './DiffViewer'
```

---

## Constants File

```ts
// components/diff-viewer/constants.ts

/** Files with this many or fewer changed lines start expanded. */
export const AUTO_EXPAND_MAX_LINES = 200;

/** Matches a unified-diff hunk header, e.g. `@@ -1,2 +1,3 @@`. */
export const HUNK_HEADER_RE = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
```

BAD — magic number inlined in component logic:
```tsx
// BAD: what does 200 mean here?
if (file.changes.length <= 200) setOpen(true);
```

GOOD — named constant from constants.ts:
```tsx
// GOOD: intent is clear
if (file.changes.length <= AUTO_EXPAND_MAX_LINES) setOpen(true);
```

---

## Styles File

```ts
// components/diff-viewer/styles.ts
import type { CSSProperties } from "react";

export const s = {
  list: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  fileCard: {
    border: "1px solid var(--border)",
    borderRadius: 7,
    overflow: "hidden",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
} as const;

// Dynamic styles are exported as small functions, not inlined
export function lineRowFor(kind: "add" | "del" | "ctx"): CSSProperties {
  const background = kind === "add" ? "var(--code-add)" : kind === "del" ? "var(--code-del)" : "transparent";
  return { display: "flex", alignItems: "stretch", fontSize: 13, background };
}
```

BAD — inline style objects in JSX:
```tsx
// BAD: new object on every render, breaks React.memo on children
<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
```

GOOD — reference from styles.ts:
```tsx
// GOOD: stable reference
<div style={s.list}>
```

---

## Custom Hook — Business Logic Out of Component

```ts
// components/app-shell/hooks/useGlobalShortcuts.ts
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { G_NAV_TIMEOUT_MS } from "../constants";
import { isTextInput } from "../helpers";

interface GlobalShortcutHandlers {
  onOpenPalette: () => void;
  onOpenHelp: () => void;
}

export function useGlobalShortcuts({ onOpenPalette, onOpenHelp }: GlobalShortcutHandlers): void {
  const router = useRouter();
  React.useEffect(() => {
    // keyboard subscription logic lives here, NOT in AppShell.tsx
    const onKey = (e: KeyboardEvent) => { ... };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, onOpenPalette, onOpenHelp]);
}
```

BAD — event subscription inside the component body:
```tsx
// BAD: AppShell.tsx bloated with subscription logic
function AppShell() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 30 lines of keyboard logic
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // ... rest of the shell
}
```

GOOD — hook extracts the logic, component just calls it:
```tsx
// GOOD: AppShell.tsx stays focused on layout
function AppShell() {
  useGlobalShortcuts({ onOpenPalette, onOpenHelp });
  return <MantineAppShell>...</MantineAppShell>;
}
```

---

## Shared Hooks — React Query Pattern

```ts
// src/lib/hooks/reviews.ts — shared across multiple routes

export function usePrReviews(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["reviews", prId],        // consistent key format: ["resource", id]
    queryFn: () => api.get<ReviewRecord[]>(`/pulls/${prId}/reviews`),
    enabled: !!prId,                    // guard: don't fetch if no prId
  });
}

export function useDeleteReview(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => api.del<{ ok: boolean }>(`/reviews/${reviewId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews", prId] }),
  });
}
```

Rules shown here:
- One export per logical operation (not one giant hook)
- `api.get/post/del` — never raw `fetch` or `axios`
- `queryKey` always `["resource-type", id]` so invalidation works

---

## Container / Presenter Split

```tsx
// BAD: data fetching and rendering mixed in one component
function PrDetail({ prId }: { prId: string }) {
  const { data, isLoading } = usePrReviews(prId);
  if (isLoading) return <Loader />;
  return (
    <Stack>
      {data?.map(r => (
        <Paper key={r.id}>
          {/* 80 lines of rendering */}
        </Paper>
      ))}
    </Stack>
  );
}
```

```tsx
// GOOD: container handles data, presenter handles rendering
function PrDetailContainer({ prId }: { prId: string }) {
  const { data: reviews, isLoading, error } = usePrReviews(prId);
  if (isLoading) return <Loader />;
  if (error) return <ErrorState />;
  if (!reviews?.length) return <EmptyState />;
  return <PrDetailView reviews={reviews} />;
}

interface PrDetailViewProps {
  reviews: ReviewRecord[];
}
function PrDetailView({ reviews }: PrDetailViewProps) {
  // only renders — no hooks, no data fetching
  return (
    <Stack>
      {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
    </Stack>
  );
}
```

---

## Discriminated Union Props

```tsx
// BAD: ambiguous optional props
interface FindingBadgeProps {
  severity?: string;
  count?: number;
  showCount?: boolean; // unclear when this matters
}

// GOOD: discriminated union makes the variants explicit
type FindingBadgeProps =
  | { variant: 'label'; severity: SeverityLevel }
  | { variant: 'count'; severity: SeverityLevel; count: number };

function FindingBadge(props: FindingBadgeProps) {
  if (props.variant === 'count') {
    return <Badge>{props.count} {props.severity}</Badge>;
  }
  return <Badge>{props.severity}</Badge>;
}
```

---

## Route-Local vs Shared Components

```
app/
  (repos)/
    [repoId]/
      pulls/
        [number]/
          _components/       ← route-local: only used on this route
            RunTimeline.tsx
            FindingsPanel.tsx
          page.tsx

components/                  ← shared: used by 2+ routes
  diff-viewer/
  app-shell/
```

Rule: keep a component in `_components/` until you need it a second time. Then promote it to `src/components/`.

---

## Barrel (index.ts) — Only Public API

```ts
// components/diff-viewer/index.ts
// GOOD: only export what callers actually need
export { DiffViewer } from './DiffViewer';

// BAD: leaking internals
export { DiffViewer } from './DiffViewer';
export { parseHunks } from './helpers';         // internal util
export { AUTO_EXPAND_MAX_LINES } from './constants'; // internal constant
export { s } from './styles';                   // internal styles
```

---

## File Order

```tsx
"use client";                                   // 1. directive

import React from "react";                      // 2. external imports
import { useQuery } from "@tanstack/react-query";
import { Stack, Paper } from "@mantine/core";

import { api } from "@/lib/api";                // 3. internal imports
import { usePrReviews } from "@/lib/hooks/reviews";
import { formatDate } from "./helpers";
import { s } from "./styles";
import { MAX_VISIBLE } from "./constants";

interface ReviewListProps {                     // 4. types
  prId: string;
}

const EMPTY_LABEL = "No reviews yet";          // 5. module-level constants

export function ReviewList({ prId }: ReviewListProps) { // 6. component
  ...
}
```
