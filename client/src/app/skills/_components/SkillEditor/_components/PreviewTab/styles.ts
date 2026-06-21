import type { CSSProperties } from "react";

/** Co-located styles for the skill PreviewTab. */
export const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 16px" } satisfies CSSProperties,
} as const;
