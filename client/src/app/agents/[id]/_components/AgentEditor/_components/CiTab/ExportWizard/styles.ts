import type { CSSProperties } from "react";

/** Co-located styles for the Export to CI wizard (mock 01-wizard-target.png). */
export const s = {
  body: {
    padding: "20px 24px 24px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
  } satisfies CSSProperties,

  steps: {
    marginBottom: 4,
  } satisfies CSSProperties,

  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  } satisfies CSSProperties,
  footerSplit: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  } satisfies CSSProperties,
  footerRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto",
  } satisfies CSSProperties,

  placeholder: {
    padding: "32px 16px",
    textAlign: "center" as const,
    fontSize: 13,
    color: "var(--text-muted)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "var(--border)",
    borderRadius: 8,
    background: "var(--bg-surface)",
  } satisfies CSSProperties,

  noRepo: {
    padding: "16px 14px",
    fontSize: 13,
    color: "var(--warn)",
    background: "var(--warn-bg)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--border)",
    borderRadius: 8,
  } satisfies CSSProperties,

  targetGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  } satisfies CSSProperties,

  targetCard: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    gap: 8,
    padding: "16px 18px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--border)",
    borderRadius: 10,
    background: "var(--bg-surface)",
    textAlign: "left" as const,
    cursor: "pointer",
    transition: "border-color 0.12s ease, background 0.12s ease",
  } satisfies CSSProperties,
  targetCardSelected: {
    borderColor: "var(--accent)",
    background: "var(--accent-bg)",
  } satisfies CSSProperties,
  targetCardDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
    pointerEvents: "none" as const,
  } satisfies CSSProperties,

  targetCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
  } satisfies CSSProperties,
  targetIconWrap: {
    display: "grid",
    placeItems: "center",
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "var(--bg-elevated)",
    flexShrink: 0,
  } satisfies CSSProperties,
  targetIconWrapSelected: {
    background: "var(--accent)",
    color: "#fff",
  } satisfies CSSProperties,
  targetLabelRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap" as const,
    minWidth: 0,
  } satisfies CSSProperties,
  targetLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  recommendedBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: "var(--accent)",
    background: "var(--accent-bg)",
  } satisfies CSSProperties,
  targetDesc: {
    fontSize: 12,
    color: "var(--text-muted)",
    margin: 0,
    paddingLeft: 42,
  } satisfies CSSProperties,
  targetDescMono: {
    fontFamily: "var(--font-mono, monospace)",
  } satisfies CSSProperties,
} as const;
