import type { CSSProperties } from "react";

export const s = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 52px)",
    overflow: "hidden",
  } satisfies CSSProperties,

  header: {
    padding: "28px 32px 20px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flexShrink: 0,
  } satisfies CSSProperties,

  heading: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,

  subtitle: {
    fontSize: 13,
    color: "var(--text-muted)",
  } satisfies CSSProperties,

  body: {
    flex: 1,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
  } satisfies CSSProperties,

  loadingStack: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "20px 32px",
  } satisfies CSSProperties,

  list: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "20px 32px",
  } satisfies CSSProperties,

  row: {
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    cursor: "pointer",
  } satisfies CSSProperties,

  rowPath: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  } satisfies CSSProperties,

  rowIcon: {
    color: "var(--text-muted)",
    flexShrink: 0,
  } satisfies CSSProperties,

  rowPathText: {
    fontSize: 13,
    fontFamily: "var(--font-mono, monospace)",
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } satisfies CSSProperties,

  usedByBtn: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 6,
    border: "1px solid var(--border-strong)",
    background: "var(--bg-elevated)",
    color: "var(--text-secondary)",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  } satisfies CSSProperties,

  usedByNone: {
    fontSize: 12,
    color: "var(--text-muted)",
    flexShrink: 0,
  } satisfies CSSProperties,

  footer: {
    flexShrink: 0,
    padding: "12px 32px",
    borderTop: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: 16,
    fontSize: 12,
    color: "var(--text-muted)",
  } satisfies CSSProperties,

  footerScanned: {
    color: "var(--text-secondary)",
    marginLeft: "auto",
  } satisfies CSSProperties,

  previewBody: {
    whiteSpace: "pre-wrap" as const,
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 13,
    lineHeight: 1.6,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
} as const;
