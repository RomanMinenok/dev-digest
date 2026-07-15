import type { CSSProperties } from "react";

/** Co-located styles for AgentsSection. */
export const s = {
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  } satisfies CSSProperties,
  sectionHeading: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.5,
    color: "var(--text-muted)",
    textTransform: "uppercase",
  } satisfies CSSProperties,
} as const;
