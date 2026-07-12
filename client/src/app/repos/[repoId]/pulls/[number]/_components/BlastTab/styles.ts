import type { CSSProperties } from "react";

/** Co-located styles for BlastTab/BlastCard. Card chrome stays constant across
    loading/empty/error/degraded states — only the inner content varies
    (client/INSIGHTS.md: early-return branches that replace the layout break chrome). */
export const s = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: 18,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,
  countsLine: {
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  toggleGroup: {
    display: "inline-flex",
    border: "1px solid var(--border)",
    borderRadius: 7,
    overflow: "hidden",
  } satisfies CSSProperties,
  toggleBtn: (active: boolean, disabled?: boolean): CSSProperties => ({
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 600,
    border: "none",
    background: active ? "var(--bg-hover)" : "transparent",
    color: disabled ? "var(--text-muted)" : "var(--text-secondary)",
    cursor: disabled ? "not-allowed" : "pointer",
  }),
  emptyBody: {
    fontSize: 13,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  summaryBox: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "var(--text-primary)",
    padding: 12,
    borderRadius: 8,
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
  } satisfies CSSProperties,
  tree: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  } satisfies CSSProperties,
  symbolRow: {
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    overflow: "hidden",
  } satisfies CSSProperties,
  symbolHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 12px",
    cursor: "pointer",
  } satisfies CSSProperties,
  symbolName: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  symbolFile: {
    fontSize: 12,
    color: "var(--text-muted)",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  symbolCount: {
    marginLeft: "auto",
    fontSize: 12,
    color: "var(--text-muted)",
    flexShrink: 0,
  } satisfies CSSProperties,
  symbolBody: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "0 12px 12px 30px",
  } satisfies CSSProperties,
  callerList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  } satisfies CSSProperties,
  callerLink: {
    fontSize: 12.5,
    color: "var(--text-secondary)",
    borderBottom: "1px dashed var(--border-strong)",
    width: "fit-content",
  } satisfies CSSProperties,
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  } satisfies CSSProperties,
} as const;
