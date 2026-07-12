/* PreviewModal — read-only rendered content for a single context doc (AC-9).
   Never attaches/detaches the doc; only fetches + displays it via
   useContextDocPreview. Content is untrusted repo text — rendered as plain
   text (no HTML/markdown execution), never via dangerouslySetInnerHTML. */
"use client";

import { useTranslations } from "next-intl";
import { Modal, Skeleton, ErrorState } from "@devdigest/ui";
import { useContextDocPreview } from "../../../../../../../../lib/hooks/context-docs";
import { ApiError } from "../../../../../../../../lib/api";
import { formatTokenCount } from "../helpers";
import { s } from "../styles";

interface PreviewModalProps {
  repoId: string | null | undefined;
  path: string;
  onClose: () => void;
}

export function PreviewModal({ repoId, path, onClose }: PreviewModalProps) {
  const t = useTranslations("agents");
  const preview = useContextDocPreview(repoId, path);

  return (
    <Modal title={path} onClose={onClose} width={720}>
      {preview.isLoading ? (
        <div style={{ padding: 24 }}>
          <Skeleton height={200} />
        </div>
      ) : preview.isError ? (
        <ErrorState
          title={t("context.previewError")}
          body={preview.error instanceof ApiError ? preview.error.message : undefined}
          onRetry={() => preview.refetch()}
        />
      ) : (
        <>
          <div style={{ ...s.previewMeta, padding: "16px 24px 0" }}>
            {t("context.previewTokens", {
              count: formatTokenCount(preview.data?.token_estimate ?? 0),
            })}
          </div>
          <div style={s.previewBody}>{preview.data?.content}</div>
        </>
      )}
    </Modal>
  );
}
