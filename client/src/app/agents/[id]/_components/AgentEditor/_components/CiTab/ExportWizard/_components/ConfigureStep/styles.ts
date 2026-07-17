import type { CSSProperties } from "react";

/** Configure step layout — mock 04-wizard-configure.png. */
export const s = {
  stack: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
  } satisfies CSSProperties,

  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  } satisfies CSSProperties,
  sectionLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
  } satisfies CSSProperties,

  chipRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
  } satisfies CSSProperties,
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--bg-surface)",
    color: "var(--text-secondary)",
    fontSize: 12,
    fontFamily: "var(--font-mono, monospace)",
    cursor: "pointer",
    transition: "border-color 0.12s ease, background 0.12s ease, color 0.12s ease",
  } satisfies CSSProperties,
  chipActive: {
    borderColor: "var(--accent)",
    background: "var(--accent-bg)",
    color: "var(--text-primary)",
  } satisfies CSSProperties,

  radioGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  } satisfies CSSProperties,
  radioRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-primary)",
    cursor: "pointer",
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

  secretsTable: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 0,
    borderRadius: 8,
    border: "1px solid var(--border)",
    overflow: "hidden",
  } satisfies CSSProperties,
  secretRow: {
    display: "grid",
    gridTemplateColumns: "minmax(140px, 1.1fr) minmax(0, 1.6fr) auto",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  secretRowLast: {
    borderBottom: "none",
  } satisfies CSSProperties,
  secretName: {
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "var(--font-mono, monospace)",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  secretDesc: {
    fontSize: 12,
    color: "var(--text-muted)",
    lineHeight: 1.4,
  } satisfies CSSProperties,
  secretStatus: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: "nowrap" as const,
  } satisfies CSSProperties,
  secretStatusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    flexShrink: 0,
  } satisfies CSSProperties,
  secretsHint: {
    fontSize: 12,
    color: "var(--text-muted)",
    lineHeight: 1.45,
  } satisfies CSSProperties,

  callout: {
    display: "flex",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    fontSize: 13,
    color: "var(--text-muted)",
    lineHeight: 1.5,
  } satisfies CSSProperties,
  calloutIcon: {
    flexShrink: 0,
    marginTop: 1,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  calloutStrong: {
    fontWeight: 600,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
} as const;
