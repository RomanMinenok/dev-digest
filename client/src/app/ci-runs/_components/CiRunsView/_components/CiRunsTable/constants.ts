import type { CiRunStatus } from "@devdigest/shared";

export const STATUS_KEYS = {
  succeeded: "succeeded",
  changesRequested: "changesRequested",
  error: "error",
  noFindings: "noFindings",
  failed: "failed",
  running: "running",
} as const;

export type StatusVisual = {
  i18nKey: (typeof STATUS_KEYS)[keyof typeof STATUS_KEYS] | null;
  color: string;
  bg: string;
};

/** Badge colors per mock `06-ci-runs.png`. */
export function statusVisual(status: string | null | undefined): StatusVisual {
  switch (status as CiRunStatus | null | undefined) {
    case "succeeded":
      return { i18nKey: "succeeded", color: "var(--ok)", bg: "var(--ok-bg)" };
    case "changes_requested":
      return { i18nKey: "changesRequested", color: "var(--warn)", bg: "var(--warn-bg)" };
    case "error":
      return { i18nKey: "error", color: "var(--crit)", bg: "var(--crit-bg)" };
    case "no_findings":
      return { i18nKey: "noFindings", color: "var(--ok)", bg: "var(--bg-hover)" };
    case "failed":
      return { i18nKey: "error", color: "var(--crit)", bg: "var(--crit-bg)" };
    case "running":
      return { i18nKey: "running", color: "var(--accent)", bg: "var(--accent-bg)" };
    default:
      return { i18nKey: null, color: "var(--text-muted)", bg: "var(--bg-hover)" };
  }
}

/** timestamp | pull request | agent | source | dur | findings | cost | status | trace */
export const GRID_TEMPLATE_COLUMNS =
  "130px minmax(160px, 1.4fr) minmax(120px, 1fr) 120px 56px 72px 64px 140px 32px";
