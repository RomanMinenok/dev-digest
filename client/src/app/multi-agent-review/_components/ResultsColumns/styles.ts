import type { CSSProperties } from "react";

export const s = {
  root: { width: "100%", display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  contextStrip: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 12.5,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  contextText: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,
  grid: {
    display: "flex",
    gap: 14,
    overflowX: "auto",
    alignItems: "flex-start",
  } satisfies CSSProperties,
} as const;
