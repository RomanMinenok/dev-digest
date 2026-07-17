import type { CSSProperties } from "react";

export const s = {
  root: { width: "100%", display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  title: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12.5,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  // Shrink-wrap group cards to the cell row so a full-bleed card doesn't leave
  // empty space past the last agent column (lanes above are also content-width).
  list: { display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" } satisfies CSSProperties,
  groupCard: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "fit-content",
    maxWidth: "100%",
    padding: "12px 0",
    borderRadius: 8,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
  } satisfies CSSProperties,
  groupHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12.5,
    flexWrap: "wrap",
    padding: "0 14px",
  } satisfies CSSProperties,
  groupLocation: {
    fontFamily: "var(--font-mono, monospace)",
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  groupLabel: { fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  // Gap + cell width match ResultsColumns/Lane (width: 260, gap: 14) so the
  // matrix columns line up with the lanes above instead of stretching.
  cellRow: { display: "flex", flexWrap: "wrap", gap: 14 } satisfies CSSProperties,
  cell: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    width: 260,
    flexShrink: 0,
    padding: "8px 10px",
    borderRadius: 6,
    background: "var(--bg-hover)",
  } satisfies CSSProperties,
  cellAgentName: { fontSize: 12, fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  // Two-line clamp. `WebkitLineClamp` needs all four of -webkit-box, the
  // orient, the clamp and overflow:hidden — drop any one and the text runs
  // to full height. `minWidth: 0` lets it shrink inside the flex cell instead
  // of forcing the column wider than its `flex-basis`.
  cellTitle: {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    overflow: "hidden",
    minWidth: 0,
    fontSize: 12,
    lineHeight: 1.35,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  mutedState: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  failedState: { fontSize: 12, color: "var(--crit)" } satisfies CSSProperties,
  emptyNote: {
    padding: "20px 14px",
    textAlign: "center",
    color: "var(--text-secondary)",
    fontSize: 13,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
} as const;
