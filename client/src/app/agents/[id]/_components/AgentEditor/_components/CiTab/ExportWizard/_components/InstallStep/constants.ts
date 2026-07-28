import type { IconName } from "@devdigest/ui";

/** Install action — maps to `CiExportInput.action`. */
export type InstallMethod = "open_pr" | "files";

export type InstallMethodDef = {
  id: InstallMethod;
  icon: IconName;
  recommended?: boolean;
};

/** Card order per mock 05-wizard-install.png. */
export const INSTALL_METHODS: InstallMethodDef[] = [
  { id: "open_pr", icon: "GitPullRequest", recommended: true },
  { id: "files", icon: "Copy" },
];

/** Fallback when preview data is unavailable (AC-4: six files for a two-skill agent). */
export const GENERATED_FILE_COUNT_FALLBACK = 6;

/** External setup reference shown below the install cards. */
export const CI_SETUP_DOCS_URL = "https://docs.github.com/en/actions";
