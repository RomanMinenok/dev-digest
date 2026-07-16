import type { CSSProperties } from "react";

/** checkbox | ran-at | version | recall | precision | citation | pass | cost
    (mock 02). Matches the cross-agent RunsTable minus the agent-name column. */
const GRID_TEMPLATE_COLUMNS = "32px 130px 56px 100px 100px 100px 56px 72px";

export const s = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  } satisfies CSSProperties,
  heading: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.03em",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  } satisfies CSSProperties,
  selectedCount: {
    fontSize: 12,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  table: {
    display: "flex",
    flexDirection: "column",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    overflow: "hidden",
  } satisfies CSSProperties,
  ranAt: {
    fontSize: 12,
    color: "var(--text-secondary)",
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,
  empty: {
    padding: "40px 16px",
    textAlign: "center",
    fontSize: 13,
    color: "var(--text-muted)",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
} as const;

/** Row style — top border on every row except the first; selected rows tint. */
export function row(index: number, selected: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    borderTop: index === 0 ? "none" : "1px solid var(--border)",
    background: selected ? "var(--bg-hover)" : "transparent",
  };
}
