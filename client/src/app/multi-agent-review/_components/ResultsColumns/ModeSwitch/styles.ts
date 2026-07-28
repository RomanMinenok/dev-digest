import type { CSSProperties } from "react";

export const s = {
  wrap: {
    display: "inline-flex",
    padding: 2,
    borderRadius: 7,
    background: "var(--bg-hover)",
    border: "1px solid var(--border)",
    gap: 2,
  } satisfies CSSProperties,
  button: {
    border: "none",
    borderRadius: 5,
    padding: "5px 12px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    background: "transparent",
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  buttonActive: {
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
} as const;
