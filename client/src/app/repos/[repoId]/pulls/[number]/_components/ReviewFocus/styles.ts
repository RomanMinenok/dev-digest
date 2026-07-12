import type { CSSProperties } from "react";

/** Co-located styles for ReviewFocus — a full-width section (not a card),
    listing each `review_focus` item as a row: severity dot, description,
    file+line-range deep-link. Mirrors IntentCard's `risksSection`/`riskRow`
    pattern but without the card `wrap` chrome, since this section sits
    directly in the tab's vertical stack alongside other full-width sections
    (see OverviewTab's `Description` section). */
export const s = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } satisfies CSSProperties,
  emptyBody: {
    fontSize: 13,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  itemRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "8px 0",
    borderTop: "1px solid var(--border)",
  } satisfies CSSProperties,
  itemIcon: (color: string): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
    color,
  }),
  itemBody: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 0,
  } satisfies CSSProperties,
  itemDescription: {
    fontSize: 13,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  itemLink: {
    fontSize: 12,
    color: "var(--text-muted)",
    borderBottom: "1px dashed var(--text-muted)",
    paddingBottom: 1,
    width: "fit-content",
  } satisfies CSSProperties,
} as const;
