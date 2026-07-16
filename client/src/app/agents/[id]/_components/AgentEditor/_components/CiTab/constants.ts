import type { CiRunStatus, CiTarget } from "@devdigest/shared";

export const TARGET_I18N: Record<CiTarget, string> = {
  gha: "exportWizard.targets.gha",
  circle: "exportWizard.targets.circle",
  jenkins: "exportWizard.targets.jenkins",
  cli: "exportWizard.targets.cli",
};

export type StatusVisual = {
  i18nKey: "succeeded" | "noFindings" | "failed" | "running" | null;
  color: string;
  bg: string;
};

/** Badge colors aligned with CI Runs table (mock 06-ci-runs.png). */
export function statusVisual(status: string | null | undefined): StatusVisual {
  switch (status as CiRunStatus | null | undefined) {
    case "succeeded":
      return { i18nKey: "succeeded", color: "var(--ok)", bg: "var(--ok-bg)" };
    case "no_findings":
      return { i18nKey: "noFindings", color: "var(--ok)", bg: "var(--bg-hover)" };
    case "failed":
      return { i18nKey: "failed", color: "var(--crit)", bg: "var(--crit-bg)" };
    case "running":
      return { i18nKey: "running", color: "var(--accent)", bg: "var(--accent-bg)" };
    default:
      return { i18nKey: null, color: "var(--text-muted)", bg: "var(--bg-hover)" };
  }
}
