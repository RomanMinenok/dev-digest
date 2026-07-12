import type { CSSProperties } from "react";

/** Co-located styles for PrBriefCard. Card chrome (border/padding) stays
    constant across unavailable/loading/loaded/error states — only the inner
    content varies (see client/INSIGHTS.md "Early-return branches … break
    chrome"). */
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
  verdictRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  iconBox: (bg: string, color: string): CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    background: bg,
    color,
    flexShrink: 0,
  }),
  verdictLabel: (color: string): CSSProperties => ({ fontSize: 15, fontWeight: 700, color }),
  /* Brief's own tokens_in→tokens_out / cost_usd badge — visually distinct from
     the review-run's cost badge shown elsewhere on the page (RunHistory /
     ReviewRunAccordion), so it never reads as "the review cost" by mistake:
     dashed border + explicit "Brief cost" label instead of a plain pill. */
  briefCostBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 9px",
    borderRadius: 6,
    border: "1px dashed var(--border)",
    fontSize: 11.5,
    color: "var(--text-muted)",
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
