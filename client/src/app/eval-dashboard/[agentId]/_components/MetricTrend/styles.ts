import type { CSSProperties } from "react";

/** Co-located styles for MetricTrend. */
export const s = {
  card: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    padding: 18,
  } satisfies CSSProperties,
  heading: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.03em",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  legend: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  } satisfies CSSProperties,
  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
    flexShrink: 0,
  } satisfies CSSProperties,
  empty: {
    padding: "40px 16px",
    textAlign: "center",
    fontSize: 13,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
} as const;

/** Legend swatch colour is dynamic (per series). */
export function swatchStyle(color: string): CSSProperties {
  return { ...s.swatch, background: color };
}
