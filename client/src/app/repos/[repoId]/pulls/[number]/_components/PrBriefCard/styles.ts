import type { CSSProperties } from "react";

/** Co-located styles for PrBriefCard. Card chrome (border/padding) stays
    constant across unavailable/loading/loaded/error states — only the inner
    content varies (see client/INSIGHTS.md "Early-return branches … break
    chrome"). Verdict header mirrors VerdictBanner; score + brief cost sit in
    a right column (circle above, cost/tokens below a divider). */
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
  } satisfies CSSProperties,
  /** Verdict + summary (left) and score/cost (right), like VerdictBanner. */
  bodyRow: {
    display: "flex",
    gap: 18,
    alignItems: "flex-start",
  } satisfies CSSProperties,
  iconBox: (bg: string, color: string): CSSProperties => ({
    width: 40,
    height: 40,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    background: bg,
    color,
    flexShrink: 0,
  }),
  main: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  verdictLabel: (color: string): CSSProperties => ({
    fontSize: 18,
    fontWeight: 700,
    color,
  }),
  summary: {
    fontSize: 14,
    lineHeight: 1.55,
    color: "var(--text-secondary)",
    marginTop: 8,
  } satisfies CSSProperties,
  scoreCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
    minWidth: 88,
  } satisfies CSSProperties,
  scoreLabel: {
    fontSize: 11,
    color: "var(--text-muted)",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  } satisfies CSSProperties,
  scoreDivider: {
    width: "100%",
    height: 1,
    background: "var(--border)",
    marginTop: 4,
    marginBottom: 2,
  } satisfies CSSProperties,
  /** Brief tokens/cost under the score circle — mono, right-column aligned. */
  costRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11.5,
    color: "var(--text-muted)",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  costValue: {
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: 4,
  } satisfies CSSProperties,
  paragraph: {
    fontSize: 14,
    lineHeight: 1.55,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  emptyBody: {
    fontSize: 13,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  errorText: {
    fontSize: 13,
    color: "var(--crit)",
  } satisfies CSSProperties,
} as const;
