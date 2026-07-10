"use client";

import { useTranslations } from "next-intl";
import { Drawer, Skeleton, ErrorState } from "@devdigest/ui";
import { useContextDocPreview } from "../../../../lib/hooks/context-docs";
import { ApiError } from "../../../../lib/api";
import { formatTokenCount } from "./helpers";
import { s } from "./styles";

interface PreviewDrawerProps {
  repoId: string | null | undefined;
  path: string;
  onClose: () => void;
}

/** Right-side drawer showing a discovered doc's rendered content (read-only)
 * when its row is clicked on the Project Context list page. Untrusted repo
 * text — rendered as plain text, never via dangerouslySetInnerHTML. */
export function PreviewDrawer({ repoId, path, onClose }: PreviewDrawerProps) {
  const t = useTranslations("projectContext");
  const preview = useContextDocPreview(repoId, path);

  return (
    <Drawer
      title={path}
      subtitle={
        !preview.isLoading && !preview.isError
          ? t("preview.tokens", { count: formatTokenCount(preview.data?.token_estimate ?? 0) })
          : undefined
      }
      onClose={onClose}
      width={640}
    >
      {preview.isLoading ? (
        <Skeleton height={200} />
      ) : preview.isError ? (
        <ErrorState
          title={t("preview.error")}
          body={preview.error instanceof ApiError ? preview.error.message : undefined}
          onRetry={() => preview.refetch()}
        />
      ) : (
        <div style={s.previewBody}>{preview.data?.content}</div>
      )}
    </Drawer>
  );
}
