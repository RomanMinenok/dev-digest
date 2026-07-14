import type { CSSProperties } from "react";

/** Co-located styles for EvalRunDetailModal. */
export const s = {
  body: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: "18px 24px",
  } satisfies CSSProperties,

  statusStrip: (passed: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 8,
    background: passed
      ? "var(--success-bg, rgba(34,197,94,0.10))"
      : "var(--crit-bg, rgba(239,68,68,0.10))",
    color: passed ? "var(--success, #22c55e)" : "var(--crit)",
    fontSize: 13,
    fontWeight: 500,
  }),

  scoreGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  } satisfies CSSProperties,

  scoreCard: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "10px 12px",
  } satisfies CSSProperties,

  scoreLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.06em",
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    marginBottom: 4,
  } satisfies CSSProperties,

  scoreValue: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text-primary)",
  } satisfies CSSProperties,

  scoreSub: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginTop: 2,
  } satisfies CSSProperties,

  columns: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  } satisfies CSSProperties,

  columnLabel: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
    marginBottom: 8,
  } satisfies CSSProperties,

  findingList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } satisfies CSSProperties,

  findingRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,

  findingRowMatched: {
    borderColor: "var(--success, #22c55e)",
  } satisfies CSSProperties,

  findingIcon: {
    flexShrink: 0,
    marginTop: 1,
  } satisfies CSSProperties,

  findingIconMatched: { color: "var(--success, #22c55e)" } satisfies CSSProperties,
  findingIconUnmatched: { color: "var(--text-muted)" } satisfies CSSProperties,

  findingBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  } satisfies CSSProperties,

  findingLoc: {
    fontSize: 12,
    fontFamily: "var(--font-mono, monospace)",
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } satisfies CSSProperties,

  findingTitle: {
    fontSize: 12,
    color: "var(--text-primary)",
  } satisfies CSSProperties,

  findingMeta: {
    fontSize: 11,
    color: "var(--text-muted)",
  } satisfies CSSProperties,

  emptyList: {
    padding: "14px 10px",
    fontSize: 12,
    color: "var(--text-muted)",
    textAlign: "center" as const,
    borderRadius: 7,
    border: "1px dashed var(--border)",
  } satisfies CSSProperties,
} as const;
