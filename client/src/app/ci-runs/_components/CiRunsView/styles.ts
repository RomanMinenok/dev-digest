import type { CSSProperties } from "react";

/** Co-located styles for CiRunsView container. */
export const s = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    padding: "24px 32px 44px",
    maxWidth: 1280,
    margin: "0 auto",
    width: "100%",
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
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  } satisfies CSSProperties,
  tableArea: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: 200,
  } satisfies CSSProperties,
  loadingStack: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } satisfies CSSProperties,
} as const;
