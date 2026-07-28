import type { CSSProperties } from "react";

export const s = {
  card: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "16px 18px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  body: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 } satisfies CSSProperties,
  name: { fontSize: 15, fontWeight: 650, color: "var(--text-primary)" } satisfies CSSProperties,
  meta: { fontSize: 12.5, color: "var(--text-secondary)" } satisfies CSSProperties,
} as const;
