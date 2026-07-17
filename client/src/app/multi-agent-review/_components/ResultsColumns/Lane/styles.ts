import type { CSSProperties } from "react";
import type { Severity } from "@devdigest/shared";
import { SEV } from "@devdigest/ui";

export const s = {
  card: {
    width: 260,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 8,
  } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderBottom: "1px solid var(--border)",
  } satisfies CSSProperties,
  headerBody: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 } satisfies CSSProperties,
  headerName: {
    fontSize: 13.5,
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  headerMeta: {
    fontSize: 11.5,
    color: "var(--text-muted)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  body: { display: "flex", flexDirection: "column", gap: 8, padding: 10, minHeight: 60, flex: 1 } satisfies CSSProperties,
  errorBox: {
    fontSize: 12.5,
    color: "var(--crit)",
    background: "var(--crit-bg)",
    border: "1px solid var(--crit)",
    borderRadius: 6,
    padding: "8px 10px",
    lineHeight: 1.4,
  } satisfies CSSProperties,
  emptyNote: {
    fontSize: 12.5,
    color: "var(--text-muted)",
    padding: "8px 4px",
  } satisfies CSSProperties,
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 10px",
    borderTop: "1px solid var(--border)",
  } satisfies CSSProperties,
  footerCount: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;

export function findingCard(severity: Severity): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "8px 10px",
    borderRadius: 5,
    borderLeft: `3px solid ${SEV[severity].c}`,
    background: "var(--bg-hover)",
  };
}

export const findingTitleRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 6,
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--text-primary)",
};

export function findingIconColor(severity: Severity): string {
  return SEV[severity].c;
}

export const findingLocation: CSSProperties = {
  fontSize: 11.5,
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono, monospace)",
};
