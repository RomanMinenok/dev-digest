import type { CSSProperties } from "react";
import type { DiffLine } from "./helpers";

/** Co-located styles for the skill VersionsTab + Diff modal. */
export const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  head: { marginBottom: 16 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  count: { fontSize: 13, color: "var(--text-muted)", marginLeft: 8, fontWeight: 500 } satisfies CSSProperties,
  sub: { fontSize: 13, color: "var(--text-secondary)", marginTop: 4 } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    marginBottom: 8,
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  rowMain: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  rowTop: { display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  summary: { fontSize: 14, color: "var(--text-primary)", marginTop: 4 } satisfies CSSProperties,
  date: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 } satisfies CSSProperties,
  rowActions: { display: "flex", gap: 8, flexShrink: 0 } satisfies CSSProperties,
  diffBody: { padding: 0 } satisfies CSSProperties,
  diffLine: (kind: DiffLine["kind"]): CSSProperties => ({
    display: "flex",
    fontSize: 12.5,
    lineHeight: 1.6,
    padding: "0 14px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background:
      kind === "add" ? "var(--ok-bg, #052e1c)" : kind === "del" ? "var(--crit-bg, #2e0a0a)" : "transparent",
    color: kind === "ctx" ? "var(--text-secondary)" : "var(--text-primary)",
  }),
  diffGutter: (kind: DiffLine["kind"]): CSSProperties => ({
    width: 16,
    flexShrink: 0,
    color: kind === "add" ? "var(--ok)" : kind === "del" ? "var(--crit)" : "var(--text-muted)",
    userSelect: "none",
  }),
  footer: { display: "flex", justifyContent: "flex-end" } satisfies CSSProperties,
} as const;
