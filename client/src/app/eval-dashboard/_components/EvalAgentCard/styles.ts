import type { CSSProperties } from "react";

/** Co-located styles for EvalAgentCard. */
export const s = {
  card: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "14px 16px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    marginBottom: 10,
    color: "inherit",
    textDecoration: "none",
    cursor: "pointer",
  } satisfies CSSProperties,
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 7,
    background: "var(--accent-bg)",
    color: "var(--accent)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  } satisfies CSSProperties,
  main: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 0,
    flex: 1,
  } satisfies CSSProperties,
  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,
  name: {
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  modelChip: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-secondary)",
    background: "var(--bg-hover)",
    fontFamily: "var(--font-mono, monospace)",
    padding: "1px 8px",
    borderRadius: 4,
    flexShrink: 0,
  } satisfies CSSProperties,
  secondaryLine: {
    fontSize: 12.5,
    color: "var(--text-muted)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  staleLabel: {
    fontSize: 12,
    color: "var(--warn)",
  } satisfies CSSProperties,
  sparklineWrap: {
    flexShrink: 0,
  } satisfies CSSProperties,
  readouts: {
    display: "flex",
    alignItems: "flex-start",
    gap: 22,
    flexShrink: 0,
  } satisfies CSSProperties,
  readoutCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    minWidth: 40,
  } satisfies CSSProperties,
  readoutLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.4,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  readoutValue: {
    fontSize: 14,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,
  chevron: {
    flexShrink: 0,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  ctaButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: "var(--accent)",
    background: "var(--accent-bg)",
    border: "none",
    borderRadius: 6,
    padding: "6px 12px",
    cursor: "pointer",
    flexShrink: 0,
  } satisfies CSSProperties,
} as const;

/** Dynamic readout value color — depends on the metric field, so a function. */
export function readoutValueColor(color: string): CSSProperties {
  return { color };
}
