import type { CSSProperties } from "react";

/** Co-located styles for CompareRunsModal. */
export const s = {
  body: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    padding: 24,
  } satisfies CSSProperties,
  cardsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  } satisfies CSSProperties,
  card: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    border: "1px solid var(--border)",
    borderRadius: 9,
    background: "var(--bg-surface)",
    padding: 14,
  } satisfies CSSProperties,
  cardLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.03em",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  cardValues: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    fontSize: 18,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,
  cardArrow: {
    fontSize: 13,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  cardOld: {
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  deltaChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    fontSize: 12,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,
  diffSection: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  } satisfies CSSProperties,
  diffHeading: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.03em",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  diffPane: {
    margin: 0,
    maxHeight: 320,
    overflow: "auto",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-base)",
    fontSize: 12.5,
    lineHeight: "18px",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
  } satisfies CSSProperties,
  diffNote: {
    padding: "24px 16px",
    textAlign: "center",
    fontSize: 13,
    color: "var(--text-muted)",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-base)",
  } satisfies CSSProperties,
  footer: {
    display: "flex",
    justifyContent: "flex-end",
  } satisfies CSSProperties,
} as const;

/** Per-line diff row — coloured by kind. `add`/`del` tint the whole row; `same`
    stays neutral. `text` is rendered as a React text node (never HTML). */
const DIFF_LINE_BASE: CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "0 12px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

export function diffLineStyle(kind: "same" | "add" | "del"): CSSProperties {
  if (kind === "add") {
    return {
      ...DIFF_LINE_BASE,
      background: "color-mix(in srgb, var(--ok) 14%, transparent)",
      color: "var(--text-primary)",
    };
  }
  if (kind === "del") {
    return {
      ...DIFF_LINE_BASE,
      background: "color-mix(in srgb, var(--crit) 14%, transparent)",
      color: "var(--text-primary)",
    };
  }
  return { ...DIFF_LINE_BASE, color: "var(--text-secondary)" };
}

export const diffSign = {
  width: 10,
  flexShrink: 0,
  color: "var(--text-muted)",
  userSelect: "none",
} satisfies CSSProperties;

/** Delta-chip colour: green when the change is in the good direction, red when
    against it, muted when flat. */
export function deltaColor(delta: number, goodDirection: "up" | "down"): string {
  if (delta === 0) return "var(--text-muted)";
  const improved = goodDirection === "up" ? delta > 0 : delta < 0;
  return improved ? "var(--ok)" : "var(--crit)";
}
