import type { CSSProperties } from "react";

/** Co-located styles for AgentEvalView. */
export const s = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    padding: "24px 32px 44px",
    maxWidth: 1100,
    margin: "0 auto",
  } satisfies CSSProperties,
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 13,
    color: "var(--text-secondary)",
    cursor: "pointer",
    width: "fit-content",
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
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } satisfies CSSProperties,
  h1: {
    fontSize: 22,
    fontWeight: 700,
  } satisfies CSSProperties,
  modelChip: {
    fontSize: 12,
    color: "var(--text-secondary)",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "2px 8px",
  } satisfies CSSProperties,
  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  staleLabel: {
    fontSize: 12,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  } satisfies CSSProperties,
  banner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "var(--warn)",
    background: "color-mix(in srgb, var(--warn) 12%, transparent)",
    border: "1px solid color-mix(in srgb, var(--warn) 35%, transparent)",
    borderRadius: 8,
    padding: "10px 14px",
  } satisfies CSSProperties,
  cardsRow: {
    display: "flex",
    gap: 16,
  } satisfies CSSProperties,
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  } satisfies CSSProperties,
  sweepError: {
    fontSize: 13,
    color: "var(--crit)",
  } satisfies CSSProperties,
} as const;
