import type { CSSProperties } from "react";

export const s = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  trigger: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-secondary)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  chevron: {
    color: "var(--text-muted)",
    flexShrink: 0,
  } satisfies CSSProperties,
} as const;
