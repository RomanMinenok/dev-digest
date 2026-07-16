import type { CSSProperties } from "react";

export const s = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    overflow: "hidden",
  } satisfies CSSProperties,
  headerRow: {
    display: "grid",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  headerCell: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  prCell: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  } satisfies CSSProperties,
  prNumber: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--accent)",
  } satisfies CSSProperties,
  prTitle: {
    fontSize: 12,
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  agentCell: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "var(--text-primary)",
    minWidth: 0,
  } satisfies CSSProperties,
  agentName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  sourceCell: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  muted: {
    fontSize: 12,
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,
  numeric: {
    fontSize: 12,
    color: "var(--text-primary)",
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,
  findings: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "nowrap",
  } satisfies CSSProperties,
  findingCount: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 500,
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,
  traceActive: {
    background: "none",
    border: "none",
    padding: 0,
    font: "inherit",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--accent)",
    cursor: "pointer",
    textDecoration: "none",
  } satisfies CSSProperties,
  traceInactive: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-muted)",
    cursor: "default",
  } satisfies CSSProperties,
} as const;

export function dataRow(index: number): CSSProperties {
  return {
    display: "grid",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    borderTop: index === 0 ? "none" : "1px solid var(--border)",
  };
}
