import type { CSSProperties } from "react";

/** Co-located styles for EvalDashboardView. */
export const s = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
    padding: "24px 28px 40px",
  } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  } satisfies CSSProperties,
  headerText: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  } satisfies CSSProperties,
  h1: {
    fontSize: 24,
    fontWeight: 700,
  } satisfies CSSProperties,
  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  } satisfies CSSProperties,
  sectionHeading: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.5,
    color: "var(--text-muted)",
    textTransform: "uppercase",
  } satisfies CSSProperties,
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  } satisfies CSSProperties,
  sweepError: {
    fontSize: 13,
    color: "var(--crit)",
  } satisfies CSSProperties,
} as const;
