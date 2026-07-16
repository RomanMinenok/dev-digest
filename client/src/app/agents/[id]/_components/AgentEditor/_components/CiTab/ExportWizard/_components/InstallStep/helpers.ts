import type { CiExportInputBody } from "@devdigest/shared";
import { ApiError } from "../../../../../../../../../../lib/api";
import type { ExportWizardState } from "../../hooks/useExportWizard";
import type { InstallMethod } from "./constants";

export function buildExportInput(
  state: Pick<
    ExportWizardState,
    "target" | "postAs" | "triggers" | "base" | "workflowOverride"
  >,
  repo: string,
  action: InstallMethod,
): CiExportInputBody {
  return {
    repo,
    target: state.target,
    post_as: state.postAs,
    triggers: state.triggers,
    base: state.base,
    action,
    ...(state.workflowOverride != null
      ? { workflow_override: state.workflowOverride }
      : {}),
  };
}

/** Trigger a browser download for a server-built zip (AC-24 — no client zip library). */
export function downloadZipBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function zipFilenameForRepo(repoFullName: string): string {
  return `devdigest-ci-${repoFullName.replace("/", "-")}.zip`;
}

/** Surface server validation rejections (T15) as the failed rule message. */
export function formatExportError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}
