import type { CSSProperties } from "react";

/** Grid column widths: agent name | ran-at | version | recall | precision |
    citation | pass | cost — matches mock 01's ordering, plus the deliberate
    COST column addition (AC-8). */
const GRID_TEMPLATE_COLUMNS = "1.4fr 130px 56px 100px 100px 100px 56px 72px";

/** Co-located styles for RunsTable. */
export const s = {
  table: {
    display: "flex",
    flexDirection: "column",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    overflow: "hidden",
  } satisfies CSSProperties,
  agentName: {
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
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

/** Dynamic row style — alternating rows need a top border except the first. */
export function row(index: number): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    borderTop: index === 0 ? "none" : "1px solid var(--border)",
  };
}
