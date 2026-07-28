import type { CSSProperties } from "react";

export const s = {
  root: { width: "100%", display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  findings: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  errorBox: {
    padding: "12px 14px",
    borderRadius: 8,
    background: "var(--crit-bg)",
    color: "var(--crit)",
    fontSize: 13,
  } satisfies CSSProperties,
  emptyNote: {
    padding: "24px 14px",
    textAlign: "center",
    color: "var(--text-secondary)",
    fontSize: 13,
  } satisfies CSSProperties,
} as const;
