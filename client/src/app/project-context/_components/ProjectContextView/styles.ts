import type { CSSProperties } from "react";
import { LIST_WIDTH } from "./constants";

export const s = {
  shell: {
    display: "flex",
    height: "calc(100vh - 52px)",
    overflow: "hidden",
  } satisfies CSSProperties,

  list: {
    width: LIST_WIDTH,
    flexShrink: 0,
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,

  header: {
    padding: "20px 20px 16px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flexShrink: 0,
  } satisfies CSSProperties,

  heading: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,

  subtitle: {
    fontSize: 12,
    color: "var(--text-muted)",
  } satisfies CSSProperties,

  listBody: {
    flex: 1,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
  } satisfies CSSProperties,

  loadingStack: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "16px 20px",
  } satisfies CSSProperties,

  rows: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "12px",
  } satisfies CSSProperties,

  row: {
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--border)",
    background: "var(--bg-surface)",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    cursor: "pointer",
  } satisfies CSSProperties,

  rowActive: {
    borderColor: "var(--border-strong)",
    background: "var(--bg-elevated)",
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
    fontSize: 12,
    fontFamily: "var(--font-mono, monospace)",
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } satisfies CSSProperties,

  usedByBtn: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 8px",
    fontSize: 11,
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
    fontSize: 11,
    color: "var(--text-muted)",
    flexShrink: 0,
  } satisfies CSSProperties,

  footer: {
    flexShrink: 0,
    padding: "10px 20px",
    borderTop: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 11,
    color: "var(--text-muted)",
    flexWrap: "wrap" as const,
  } satisfies CSSProperties,

  footerScanned: {
    color: "var(--text-secondary)",
    marginLeft: "auto",
  } satisfies CSSProperties,

  detail: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  } satisfies CSSProperties,

  detailEmpty: {
    flex: 1,
    display: "grid",
    placeItems: "center",
    minWidth: 0,
  } satisfies CSSProperties,

  detailHead: {
    flexShrink: 0,
    padding: "16px 28px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  } satisfies CSSProperties,

  detailPath: {
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "var(--font-mono, monospace)",
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } satisfies CSSProperties,

  detailTokens: {
    fontSize: 12,
    color: "var(--text-muted)",
    flexShrink: 0,
  } satisfies CSSProperties,

  detailBody: {
    flex: 1,
    overflow: "auto",
    padding: "20px 28px",
  } satisfies CSSProperties,

  previewBody: {
    whiteSpace: "pre-wrap" as const,
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 13,
    lineHeight: 1.6,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
} as const;
