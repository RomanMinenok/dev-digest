import type { CSSProperties } from "react";

/** Install step layout — mock 05-wizard-install.png. */
export const s = {
  stack: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  } satisfies CSSProperties,

  methodCard: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    gap: 8,
    width: "100%",
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
  methodCardSelected: {
    borderColor: "var(--accent)",
    background: "var(--accent-bg)",
  } satisfies CSSProperties,
  methodCardPending: {
    opacity: 0.72,
    cursor: "wait",
  } satisfies CSSProperties,

  methodHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
  } satisfies CSSProperties,
  methodIconWrap: {
    display: "grid",
    placeItems: "center",
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "var(--bg-elevated)",
    flexShrink: 0,
  } satisfies CSSProperties,
  methodIconWrapSelected: {
    background: "var(--accent)",
    color: "#fff",
  } satisfies CSSProperties,
  methodTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
    flexWrap: "wrap" as const,
  } satisfies CSSProperties,
  methodTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  methodHint: {
    marginLeft: "auto",
    fontSize: 12,
    color: "var(--text-muted)",
    whiteSpace: "nowrap" as const,
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
  methodDesc: {
    fontSize: 12,
    color: "var(--text-muted)",
    lineHeight: 1.45,
    margin: 0,
    paddingLeft: 42,
  } satisfies CSSProperties,
  repoStrong: {
    fontWeight: 600,
    color: "var(--text-primary)",
  } satisfies CSSProperties,

  helpRow: {
    marginTop: 8,
    textAlign: "center" as const,
    fontSize: 12,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  helpLink: {
    color: "var(--accent)",
    textDecoration: "none",
    fontWeight: 500,
  } satisfies CSSProperties,

  feedback: {
    marginTop: 4,
    padding: "12px 14px",
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.45,
  } satisfies CSSProperties,
  error: {
    color: "var(--danger)",
    background: "var(--danger-bg)",
    border: "1px solid var(--border)",
  } satisfies CSSProperties,
  success: {
    color: "var(--text-primary)",
    background: "var(--ok-bg)",
    border: "1px solid var(--border)",
  } satisfies CSSProperties,
  successLink: {
    color: "var(--accent)",
    fontWeight: 500,
    textDecoration: "none",
  } satisfies CSSProperties,
} as const;
