import type { CSSProperties } from "react";

/** Co-located styles for VersionChip. */
export const s = {
  chip: {
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "var(--font-mono, monospace)",
    color: "var(--accent)",
  } satisfies CSSProperties,
} as const;
