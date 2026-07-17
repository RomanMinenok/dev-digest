import type { CSSProperties } from "react";

export const s = {
  /* AppShell/AppFrame supplies no padding of its own — every route body owns
     its page padding (cf. components/page-shell/styles.ts). */
  page: { padding: "28px 32px 48px" } satisfies CSSProperties,
  /* A centered column, ~730px per design 02. Results are their own route
     (`results/`) and own their own, wider container. */
  column: { maxWidth: 730, margin: "0 auto" } satisfies CSSProperties,
  /* Aligns a step's content under its label, clearing the badge + gap. */
  stepContent: { paddingLeft: 30 } satisfies CSSProperties,
  pageHeader: { marginBottom: 28 } satisfies CSSProperties,
  pageTitle: { fontSize: 22, fontWeight: 700, margin: 0 } satisfies CSSProperties,
  pageSubtitle: {
    fontSize: 13.5,
    color: "var(--text-secondary)",
    marginTop: 6,
    maxWidth: 640,
  } satisfies CSSProperties,
  step: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 } satisfies CSSProperties,
  stepHeader: { display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontWeight: 700,
    background: "var(--accent)",
    color: "#fff",
  } satisfies CSSProperties,
  stepBadgeMuted: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontWeight: 700,
    background: "var(--bg-hover)",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  stepLabel: { fontSize: 13.5, fontWeight: 600 } satisfies CSSProperties,
  stepLabelMuted: { fontSize: 13.5, fontWeight: 600, color: "var(--text-muted)" } satisfies CSSProperties,
  agentsCard: {
    minHeight: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } satisfies CSSProperties,
} as const;
