import type { CSSProperties } from "react";

/** Co-located styles for EvalCaseModal (T21). */
export const s = {
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  } satisfies CSSProperties,

  /** Left column — Name + Input tabs */
  leftCol: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRight: "1px solid var(--border)",
  } satisfies CSSProperties,

  /** Right column — Expected output */
  rightCol: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  } satisfies CSSProperties,

  /** Padding applied inside each column's scrollable area. */
  colPad: {
    padding: "20px 24px 0",
  } satisfies CSSProperties,

  /** Section heading inside column (e.g. "Input", "Expected output"). */
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
    marginBottom: 10,
  } satisfies CSSProperties,

  /** Wrapper for the tab panel content (tab content area below the tab strip). */
  tabPanel: {
    overflow: "auto",
    padding: "16px 24px",
  } satisfies CSSProperties,

  /** Read-only text field appearance (PR meta, Files). */
  readOnly: {
    padding: "10px 12px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    color: "var(--text-secondary)",
    fontSize: 14,
    lineHeight: 1.55,
  } satisfies CSSProperties,

  /** Row in the Files tab (one file path per row). */
  fileRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 0",
    fontSize: 13,
    fontFamily: "var(--font-mono, monospace)",
    color: "var(--text-primary)",
    borderBottom: "1px solid var(--border)",
  } satisfies CSSProperties,

  /** Header bar for Expected output (label + badge + button). */
  expectedHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 24px 10px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  } satisfies CSSProperties,

  expectedHeaderLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-secondary)",
    flex: 1,
  } satisfies CSSProperties,

  /** JSON validity badge. */
  jsonBadge: (valid: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 99,
    background: valid ? "var(--success-bg, rgba(34,197,94,0.12))" : "var(--crit-bg, rgba(239,68,68,0.12))",
    color: valid ? "var(--success, #22c55e)" : "var(--crit)",
    whiteSpace: "nowrap",
  }),

  /** The specific reason the expected output is rejected, under the editor. */
  expectedError: {
    fontSize: 12,
    color: "var(--crit)",
    fontFamily: "var(--font-mono, monospace)",
    wordBreak: "break-word",
  } as CSSProperties,

  /** Last-run result strip. */
  resultStrip: (passed: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    borderRadius: 8,
    margin: "12px 24px",
    background: passed
      ? "var(--success-bg, rgba(34,197,94,0.10))"
      : "var(--crit-bg, rgba(239,68,68,0.10))",
    fontSize: 13,
    color: passed ? "var(--success, #22c55e)" : "var(--crit)",
    fontWeight: 500,
  }),

  /** Off-diff warning banner. */
  warnBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 8,
    background: "var(--warn-bg, rgba(234,179,8,0.10))",
    color: "var(--warn, #ca8a04)",
    fontSize: 12,
    lineHeight: 1.5,
    marginBottom: 12,
  } satisfies CSSProperties,

  footer: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } satisfies CSSProperties,

  footerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: 1,
    fontSize: 14,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,

  footerRight: {
    display: "flex",
    gap: 8,
  } satisfies CSSProperties,
} as const;
