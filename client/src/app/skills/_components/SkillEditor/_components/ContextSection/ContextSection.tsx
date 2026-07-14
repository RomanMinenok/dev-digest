/* ContextSection — "Project context to use" section on the Skill editor
   (SPEC-01, AC-11/AC-12/AC-13). Any agent linking + enabling this skill
   inherits its attached docs (server-side union in run-executor). Mirrors
   the agent Context tab's row pattern (drag handle + checkbox + path +
   Preview, same ordering/membership rules) as closely as possible per
   AC-11 — the pure row logic and the read-only Preview modal are reused
   directly from AgentEditor/_components/ContextTab (a cross-route
   `_components/` import, same precedent as CreateSkillModal being reused
   from conventions/_components — see client/INSIGHTS.md).

   Adds a live "SERIALIZES AS" preview (AC-12) built from the ONE shared
   `serializeProjectContextBlock` helper (./serialize.ts) so it can never
   diverge from reviewer-core's real `## Project context` rendering. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useQueries } from "@tanstack/react-query";
import { TextInput, Badge, Button } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useActiveRepo } from "../../../../../../lib/repo-context";
import { api } from "../../../../../../lib/api";
import { useContextDocs, useSetSkillContextDocs } from "../../../../../../lib/hooks/context-docs";
import {
  attachedTokenTotal,
  buildRows,
  filterRows,
  formatTokenCount,
  linkedPaths,
  reorderLinked,
  toggleMembership,
  type ContextRow,
} from "../../../../../agents/[id]/_components/AgentEditor/_components/ContextTab/helpers";
import { PreviewModal } from "../../../../../agents/[id]/_components/AgentEditor/_components/ContextTab/PreviewModal";
import { serializeProjectContextBlock, type AttachedContextDoc } from "./serialize";
import { s } from "./styles";

interface ContextDocPreviewResponse {
  path: string;
  content: string;
  token_estimate: number;
}

export function ContextSection({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const { repoId } = useActiveRepo();
  const { data: discovery } = useContextDocs(repoId);
  const setSkillContextDocs = useSetSkillContextDocs();

  const [rows, setRows] = React.useState<ContextRow[]>([]);
  const [filter, setFilter] = React.useState("");
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);
  const [previewPath, setPreviewPath] = React.useState<string | null>(null);

  const docs = discovery?.docs ?? [];

  // Seed/refresh local order whenever the server data or the skill changes.
  React.useEffect(() => {
    setRows(buildRows(discovery?.docs ?? [], skill.context_docs));
  }, [discovery, skill.id, skill.context_docs]);

  const persist = (next: ContextRow[]) =>
    setSkillContextDocs.mutate({ skillId: skill.id, context_docs: linkedPaths(next) });

  const toggle = (path: string) => {
    const next = toggleMembership(rows, path);
    setRows(next);
    persist(next);
  };

  // Drag handlers operate on positions within the linked sub-list.
  const onDrop = (toLinkedIdx: number) => {
    if (dragFrom == null) return;
    const next = reorderLinked(rows, dragFrom, toLinkedIdx);
    setDragFrom(null);
    if (next === rows) return;
    setRows(next);
    persist(next);
  };

  const visible = filterRows(rows, filter);
  const totalDiscovered = docs.length;
  const attachedCount = rows.filter((r) => r.linked).length;
  const tokenTotal = attachedTokenTotal(rows);
  const attachedPaths = linkedPaths(rows);

  // Fetch each attached doc's exact content so "SERIALIZES AS" reproduces
  // the real prompt block, not a placeholder. Same (repoId, path) query
  // key/endpoint as the Preview button's useContextDocPreview, so a prior
  // Preview click's result is reused instead of double-fetched. No
  // staleTime — always live, matching the token-count requirement.
  const contentQueries = useQueries({
    queries: attachedPaths.map((path) => ({
      queryKey: ["context-docs-preview", repoId, path],
      queryFn: () =>
        api.get<ContextDocPreviewResponse>(
          `/repos/${repoId}/context-docs/preview?path=${encodeURIComponent(path)}`,
        ),
      enabled: !!repoId,
    })),
  });

  const attachedDocs: AttachedContextDoc[] = attachedPaths.map((path, i) => ({
    path,
    content: contentQueries[i]?.data?.content ?? "",
  }));
  const serialized = serializeProjectContextBlock(attachedDocs);
  const loadingContents = contentQueries.some((q) => q.isLoading);

  // Map each linked row to its index within the linked sub-list for DnD.
  let linkedSeen = -1;

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.titleRow}>
          <h2 style={s.h2}>{t("context.title")}</h2>
          <span style={s.count}>
            {t("context.attachedCount", { linked: attachedCount, total: totalDiscovered })}
          </span>
          <span style={s.tokenTotal}>
            {t("context.tokenTotal", { count: formatTokenCount(tokenTotal) })}
          </span>
        </div>
        <p style={s.subtitle}>{t("context.inheritCopy")}</p>
        <TextInput value={filter} onChange={setFilter} placeholder={t("context.filterPlaceholder")} />
        <div style={s.hint}>{t("context.orderHint")}</div>
      </div>

      <div style={s.list}>
        {visible.length === 0 ? (
          <div style={s.empty}>—</div>
        ) : (
          visible.map((row, idx) => {
            const linkedIdx = row.linked ? ++linkedSeen : -1;
            const draggable = row.linked && !filter.trim();
            const stale = row.linked && !row.doc;
            return (
              <div
                key={row.path}
                style={{
                  ...s.row,
                  ...(idx === 0 ? s.rowFirst : null),
                  ...(draggable && dragFrom === linkedIdx ? s.rowDragging : null),
                }}
                draggable={draggable}
                onDragStart={() => draggable && setDragFrom(linkedIdx)}
                onDragOver={(e) => {
                  if (draggable) e.preventDefault();
                }}
                onDrop={() => draggable && onDrop(linkedIdx)}
                onDragEnd={() => setDragFrom(null)}
              >
                <span style={{ ...s.handle, ...(draggable ? null : s.handleDisabled) }} aria-hidden>
                  ☰
                </span>
                <input
                  type="checkbox"
                  checked={row.linked}
                  onChange={() => toggle(row.path)}
                  style={s.checkbox}
                  aria-label={row.path}
                />
                <span className="mono" style={s.path} title={row.path}>
                  {row.path}
                </span>
                {stale && (
                  <Badge color="var(--warn)" icon="AlertTriangle">
                    {t("context.staleBadge")}
                  </Badge>
                )}
                <Button
                  kind="ghost"
                  size="sm"
                  icon="Eye"
                  disabled={!row.doc}
                  onClick={() => setPreviewPath(row.path)}
                >
                  {t("context.preview")}
                </Button>
              </div>
            );
          })
        )}
      </div>

      <div style={s.serializeBlock}>
        <div style={s.serializeHeader}>{t("context.serializesAs")}</div>
        <pre style={s.serializePre}>
          {attachedCount === 0
            ? t("context.serializesEmpty")
            : loadingContents
              ? t("context.serializesLoading")
              : serialized}
        </pre>
      </div>

      {previewPath && (
        <PreviewModal repoId={repoId} path={previewPath} onClose={() => setPreviewPath(null)} />
      )}
    </div>
  );
}
