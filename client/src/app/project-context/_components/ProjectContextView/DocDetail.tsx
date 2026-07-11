"use client";

import { useTranslations } from "next-intl";
import { Skeleton, ErrorState, Markdown } from "@devdigest/ui";
import { useContextDocPreview } from "../../../../lib/hooks/context-docs";
import { ApiError } from "../../../../lib/api";
import { formatTokenCount } from "./helpers";
import { s } from "./styles";

interface DocDetailProps {
  repoId: string | null | undefined;
  path: string;
}

/** Inline detail panel showing the selected doc's rendered content
 * (read-only) in the Project Context master-detail layout. Untrusted repo
 * text — rendered via react-markdown to React elements, never through
 * dangerouslySetInnerHTML. */
export function DocDetail({ repoId, path }: DocDetailProps) {
  const t = useTranslations("projectContext");
  const preview = useContextDocPreview(repoId, path);

  return (
    <div style={s.detail}>
      <div style={s.detailHead}>
        <span style={s.detailPath} title={path}>
          {path}
        </span>
        {!preview.isLoading && !preview.isError && (
          <span style={s.detailTokens}>
            {t("preview.tokens", { count: formatTokenCount(preview.data?.token_estimate ?? 0) })}
          </span>
        )}
      </div>
      <div style={s.detailBody}>
        {preview.isLoading ? (
          <Skeleton height={200} />
        ) : preview.isError ? (
          <ErrorState
            title={t("preview.error")}
            body={preview.error instanceof ApiError ? preview.error.message : undefined}
            onRetry={() => preview.refetch()}
          />
        ) : (
          <div style={s.previewBody}>
            <Markdown>{preview.data?.content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
