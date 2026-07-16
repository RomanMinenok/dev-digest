import type { CiExportInputBody, CiFile } from "@devdigest/shared";
import type { ExportWizardState } from "../../hooks/useExportWizard";

type CiPreviewInput = Omit<CiExportInputBody, "action">;

/** Human-readable file-set size for the preview header (non-functional). */
export function formatFileSetSize(totalBytes: number): string {
  if (totalBytes < 1024) return `${totalBytes} B`;
  if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(1)} KB`;
  return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Prefer the editable workflow file when auto-selecting a preview pane. */
export function defaultSelectedPath(files: CiFile[]): string | null {
  const workflow = files.find((f) => f.editable);
  if (workflow) return workflow.path;
  return files[0]?.path ?? null;
}

export function buildPreviewInput(
  state: Pick<ExportWizardState, "target" | "postAs" | "triggers" | "base">,
  repo: string,
): CiPreviewInput {
  return {
    repo,
    target: state.target,
    post_as: state.postAs,
    triggers: state.triggers,
    base: state.base,
  };
}

export function displayContentsForFile(
  file: CiFile,
  workflowOverride: string | null,
): string {
  if (file.editable && workflowOverride != null) return workflowOverride;
  return file.contents;
}
