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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexShrink: 0,
  } satisfies CSSProperties,

  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  } satisfies CSSProperties,

  heading: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    flexWrap: "wrap" as const,
  } satisfies CSSProperties,

  headingAccent: {
    color: "var(--accent)",
  } satisfies CSSProperties,

  subtitle: {
    fontSize: 13,
    color: "var(--text-muted)",
  } satisfies CSSProperties,

  toolbar: {
    padding: "12px 32px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  } satisfies CSSProperties,

  toolbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    flex: 1,
  } satisfies CSSProperties,

  deselectBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    fontSize: 13,
    fontWeight: 500,
    borderRadius: "6px 0 0 6px",
    border: "1px solid var(--border-strong)",
    background: "var(--bg-elevated)",
    color: "var(--text-secondary)",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  } satisfies CSSProperties,

  acceptedLabel: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    fontSize: 13,
    color: "var(--text-muted)",
    borderTop: "1px solid var(--border-strong)",
    borderBottom: "1px solid var(--border-strong)",
    borderRight: "1px solid var(--border-strong)",
    background: "var(--bg-elevated)",
    borderRadius: "0 6px 6px 0",
    whiteSpace: "nowrap" as const,
  } satisfies CSSProperties,

  list: {
    flex: 1,
    overflow: "auto",
    padding: "20px 32px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  } satisfies CSSProperties,

  card: {
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    padding: "18px 18px 16px",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "16px 20px",
  } satisfies CSSProperties,

  cardLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
  } satisfies CSSProperties,

  cardTitle: {
    fontSize: 15,
    fontWeight: 500,
    fontStyle: "italic",
    color: "var(--text-primary)",
    letterSpacing: "-0.01em",
  } satisfies CSSProperties,

  codeBlock: {
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    overflow: "hidden",
  } satisfies CSSProperties,

  codeHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 10px",
    borderBottom: "1px solid var(--border)",
  } satisfies CSSProperties,

  codeFilePath: {
    fontSize: 12,
    fontFamily: "var(--font-mono, monospace)",
    color: "var(--text-muted)",
  } satisfies CSSProperties,

  copyBtn: {
    display: "inline-flex",
    alignItems: "center",
    padding: 4,
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    borderRadius: 4,
    transition: "color .12s",
  } satisfies CSSProperties,

  codeBody: {
    padding: "10px 12px",
    fontSize: 13,
    fontFamily: "var(--font-mono, monospace)",
    lineHeight: 1.6,
    color: "var(--text-primary)",
    whiteSpace: "pre" as const,
    overflowX: "auto" as const,
  } satisfies CSSProperties,

  confidenceRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } satisfies CSSProperties,

  confidenceLabel: {
    fontSize: 12,
    color: "var(--text-muted)",
    flexShrink: 0,
  } satisfies CSSProperties,

  confidenceBar: {
    flex: 1,
    height: 5,
    borderRadius: 99,
    background: "var(--bg-hover)",
    overflow: "hidden",
  } satisfies CSSProperties,

  confidencePct: {
    fontSize: 12,
    color: "var(--text-secondary)",
    flexShrink: 0,
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,

  cardActions: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignSelf: "flex-start",
    flexShrink: 0,
  } satisfies CSSProperties,
} as const;
