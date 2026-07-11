"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Skeleton, ErrorState, Markdown, Dropdown } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useContextDocPreview } from "../../../../lib/hooks/context-docs";
import { ApiError } from "../../../../lib/api";
import { formatTokenCount, docFileName, agentContextDeepLink } from "./helpers";
import { s } from "./styles";

interface DocDetailProps {
  repoId: string | null | undefined;
  path: string;
  usedByAgents: Agent[];
}

/** Inline detail panel showing the selected doc's rendered content
 * (read-only) in the Project Context master-detail layout. Untrusted repo
 * text — rendered via react-markdown to React elements, never through
 * dangerouslySetInnerHTML. The header shows the filename on the left and,
 * on the right, the token count followed by the "Used by N agents" control
 * (moved here from the list row) — a dropdown deep-linking into each
 * agent's Context tab when count > 0, plain text otherwise. */
export function DocDetail({ repoId, path, usedByAgents }: DocDetailProps) {
  const t = useTranslations("projectContext");
  const router = useRouter();
  const preview = useContextDocPreview(repoId, path);
  const count = usedByAgents.length;

  return (
    <div style={s.detail}>
      <div style={s.detailHead}>
        <span style={s.detailPath} title={path}>
          {docFileName(path)}
        </span>
        <div style={s.detailHeadRight}>
          {!preview.isLoading && !preview.isError && (
            <span style={s.detailTokens}>
              {t("preview.tokens", { count: formatTokenCount(preview.data?.token_estimate ?? 0) })}
            </span>
          )}
          {count > 0 ? (
            <Dropdown
              align="right"
              trigger={
                <button type="button" style={s.usedByBtn}>
                  {t("row.usedBy", { count })}
                </button>
              }
              items={usedByAgents.map((a) => ({
                label: a.name,
                onClick: () => router.push(agentContextDeepLink(a.id, path)),
              }))}
            />
          ) : (
            <span style={s.usedByNone}>{t("row.notAttached")}</span>
          )}
        </div>
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
