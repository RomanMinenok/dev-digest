import type { CSSProperties } from "react";

/** Co-located styles for ImportSkillDrawer. */
export const s = {
  footer: { display: "flex", gap: 10, justifyContent: "flex-end" } satisfies CSSProperties,
  picker: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 } satisfies CSSProperties,
  pickHint: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  fileName: { fontSize: 13, color: "var(--text-secondary)", marginTop: 4 } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)", marginTop: 8 } satisfies CSSProperties,
  notice: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    padding: "10px 12px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    marginBottom: 16,
  } satisfies CSSProperties,
  heading: { fontSize: 15, fontWeight: 700, marginBottom: 12 } satisfies CSSProperties,
} as const;
