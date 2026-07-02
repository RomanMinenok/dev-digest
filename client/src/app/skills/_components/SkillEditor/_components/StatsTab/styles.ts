import type { CSSProperties } from "react";

/** Co-located styles for the skill StatsTab. */
export const s = {
  wrap: { maxWidth: 900, display: "flex", flexDirection: "column", gap: 20 } satisfies CSSProperties,
  metrics: { display: "flex", gap: 14 } satisfies CSSProperties,
  noDataCard: {
    flex: 1,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 9,
    padding: 18,
  } satisfies CSSProperties,
  noDataLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "0.03em",
  } satisfies CSSProperties,
  noDataValue: { fontSize: 15, color: "var(--text-muted)", marginTop: 16 } satisfies CSSProperties,
  panel: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 9,
    padding: 18,
  } satisfies CSSProperties,
  panelTitle: { fontSize: 14, fontWeight: 700, marginBottom: 12 } satisfies CSSProperties,
  agentRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
    borderTop: "1px solid var(--border)",
  } satisfies CSSProperties,
  agentName: { flex: 1, fontSize: 14, fontWeight: 600 } satisfies CSSProperties,
  empty: { fontSize: 13, color: "var(--text-muted)", padding: "8px 0" } satisfies CSSProperties,
  catPlaceholder: { fontSize: 14, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
