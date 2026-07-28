"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Textarea } from "@devdigest/ui";
import type { CiFile, CiPreview } from "@devdigest/shared";
import { defaultSelectedPath, displayContentsForFile, formatFileSetSize } from "./helpers";
import { s } from "./styles";

export interface PreviewStepProps {
  preview: CiPreview | null;
  loading: boolean;
  error: string | null;
  workflowOverride: string | null;
  onWorkflowChange: (contents: string) => void;
  onRetry: () => void;
}

/** Step 2 — file list + read-only preview; workflow YAML is editable (AC-9). */
export function PreviewStep({
  preview,
  loading,
  error,
  workflowOverride,
  onWorkflowChange,
  onRetry,
}: PreviewStepProps) {
  const t = useTranslations("ci");
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);

  const files = preview?.files ?? [];

  React.useEffect(() => {
    if (files.length === 0) {
      setSelectedPath(null);
      return;
    }
    setSelectedPath((current) => {
      if (current && files.some((f) => f.path === current)) return current;
      return defaultSelectedPath(files);
    });
  }, [files]);

  if (loading && !preview) {
    return <div style={s.stateMessage}>{t("exportWizard.generating")}</div>;
  }

  if (error) {
    return (
      <div style={s.errorMessage}>
        <p>{error}</p>
        <Button kind="ghost" onClick={onRetry}>
          {t("runs.refresh")}
        </Button>
      </div>
    );
  }

  if (!preview || files.length === 0) {
    return <div style={s.stateMessage}>{t("exportWizard.generating")}</div>;
  }

  const selected = files.find((f) => f.path === selectedPath) ?? files[0];
  if (!selected) {
    return <div style={s.stateMessage}>{t("exportWizard.generating")}</div>;
  }

  const contents = displayContentsForFile(selected, workflowOverride);

  return (
    <div style={s.shell}>
      <div>
        <div style={s.fileListHeader}>
          <span style={s.fileListTitle}>{t("exportWizard.filesToCreate")}</span>
          <span style={s.fileListSize}>{formatFileSetSize(preview.total_bytes)}</span>
        </div>
        <ul style={s.fileList} aria-label={t("exportWizard.filesToCreate")}>
          {files.map((file) => (
            <FileRow
              key={file.path}
              file={file}
              selected={file.path === selected.path}
              onSelect={() => setSelectedPath(file.path)}
            />
          ))}
        </ul>
      </div>

      <div style={s.previewPane}>
        <div style={s.previewHeader}>
          <span style={s.previewPath} title={selected.path}>
            {selected.path}
          </span>
          {selected.editable ? (
            <span style={s.editableBadge}>
              <Icon.Edit size={10} />
              {t("exportWizard.editable")}
            </span>
          ) : null}
        </div>
        <div style={s.previewBody}>
          {selected.editable ? (
            <div style={s.editableArea}>
              <Textarea
                mono
                rows={16}
                value={contents}
                onChange={onWorkflowChange}
              />
            </div>
          ) : (
            <pre style={s.readOnlyCode}>{contents}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

function FileRow({
  file,
  selected,
  onSelect,
}: {
  file: CiFile;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        style={{
          ...s.fileRow,
          ...(selected ? s.fileRowSelected : null),
        }}
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
      >
        <Icon.File size={14} color={selected ? "var(--accent)" : "var(--text-muted)"} />
        <span>{file.path}</span>
      </button>
    </li>
  );
}
