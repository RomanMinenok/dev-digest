import type { CSSProperties } from "react";

/** Co-located styles for AgentSelector. */
export const s = {
  trigger: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  } satisfies CSSProperties,
  chevron: {
    color: "var(--text-muted)",
    flexShrink: 0,
  } satisfies CSSProperties,
} as const;
