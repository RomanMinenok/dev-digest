import type { CSSProperties } from "react";

/** Co-located styles for ResultsScreen (design 04's header row + context
    strip). Full-width page: 1100 matches every other full-width route
    (AgentsListView, EvalDashboardView, AgentEvalView) — page-shell's 1200 is
    an outlier used only by the home page. */
export const s = {
  page: { padding: "20px 32px 48px" } satisfies CSSProperties,
  wide: { maxWidth: 1100, margin: "0 auto" } satisfies CSSProperties,
  headerRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    paddingBottom: 14,
  } satisfies CSSProperties,
  title: { fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" } satisfies CSSProperties,
  subtitle: { fontSize: 12.5, color: "var(--text-secondary)" } satisfies CSSProperties,
  headerRight: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  contextStrip: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 0 16px",
    borderTop: "1px solid var(--border)",
    fontSize: 12.5,
  } satisfies CSSProperties,
  prNumber: { color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" } satisfies CSSProperties,
  prTitle: { color: "var(--text-primary)", fontWeight: 600 } satisfies CSSProperties,
  totals: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "var(--text-secondary)",
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,
  body: { display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  stateCard: {
    minHeight: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } satisfies CSSProperties,
} as const;
