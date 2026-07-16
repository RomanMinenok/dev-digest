import type { CSSProperties } from "react";

/** Co-located styles for the agent Skills tab. */
export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  header: { marginBottom: 16 } satisfies CSSProperties,
  titleRow: { display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  count: { fontSize: 13, color: "var(--text-secondary)" } satisfies CSSProperties,
  hint: { fontSize: 12, color: "var(--text-muted)", marginTop: 8 } satisfies CSSProperties,
  actions: { display: "flex", alignItems: "center", gap: 12, marginTop: 12 } satisfies CSSProperties,
  unsaved: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  list: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-surface)",
    overflow: "hidden",
  } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderTop: "1px solid var(--border)",
  } satisfies CSSProperties,
  rowFirst: { borderTop: "none" } satisfies CSSProperties,
  rowDragging: { opacity: 0.4 } satisfies CSSProperties,
  handle: {
    cursor: "grab",
    color: "var(--text-muted)",
    fontSize: 15,
    lineHeight: 1,
    userSelect: "none",
    width: 16,
    textAlign: "center",
  } satisfies CSSProperties,
  handleDisabled: { cursor: "default", opacity: 0.3 } satisfies CSSProperties,
  checkbox: { cursor: "pointer", width: 15, height: 15, accentColor: "var(--accent)" } satisfies CSSProperties,
  name: { flex: 1, fontSize: 13, color: "var(--text-primary)", minWidth: 0 } satisfies CSSProperties,
  empty: {
    padding: "18px 14px",
    fontSize: 13,
    color: "var(--text-muted)",
    textAlign: "center",
  } satisfies CSSProperties,
} as const;
