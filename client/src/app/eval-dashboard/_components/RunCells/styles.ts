import type { CSSProperties } from "react";

/** Co-located styles for PassCell / CostCell. */
export const s = {
  passCell: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-primary)",
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,
  costCell: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-primary)",
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,
  costUnavailable: {
    fontSize: 12,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
} as const;
