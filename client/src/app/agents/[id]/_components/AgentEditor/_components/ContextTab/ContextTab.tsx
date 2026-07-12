/* ContextTab — attach/detach + reorder the Project Context docs (SPEC-01)
   used by an agent. Mirrors SkillsTab's file split/DnD/style conventions:
   attached rows come first (in order), then unattached; toggling or dropping
   a reordered row immediately persists the ordered attached paths via
   useSetAgentContextDocs. Reorder uses native HTML5 drag (no DnD dep in the
   repo); the pure ordering logic lives in helpers.ts.

   Repo-scoped via useActiveRepo() (same as the Project Context list page) —
   discovery + preview data is deliberately NOT cached (no staleTime), so the
   token count and stale-doc badge (AC-24) are always fresh on load. */
"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { TextInput, Badge, Button } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useActiveRepo } from "../../../../../../../lib/repo-context";
import { useContextDocs, useSetAgentContextDocs } from "../../../../../../../lib/hooks/context-docs";
import {
  attachedTokenTotal,
  buildRows,
  filterRows,
  formatTokenCount,
  linkedPaths,
  reorderLinked,
  toggleMembership,
  type ContextRow,
} from "./helpers";
import { PreviewModal } from "./PreviewModal";
import { s } from "./styles";

export function ContextTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const search = useSearchParams();
  const highlightPath = search.get("contextDoc");

  const { repoId } = useActiveRepo();
  const { data: discovery } = useContextDocs(repoId);
  const setAgentContextDocs = useSetAgentContextDocs();

  const [rows, setRows] = React.useState<ContextRow[]>([]);
  const [filter, setFilter] = React.useState("");
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);
  const [previewPath, setPreviewPath] = React.useState<string | null>(null);

  const docs = discovery?.docs ?? [];

  // Seed/refresh local order whenever the server data or the agent changes.
  React.useEffect(() => {
    setRows(buildRows(discovery?.docs ?? [], agent.context_docs));
  }, [discovery, agent.id, agent.context_docs]);

  const persist = (next: ContextRow[]) =>
    setAgentContextDocs.mutate({ agentId: agent.id, context_docs: linkedPaths(next) });

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
                  ...(row.path === highlightPath ? s.rowHighlight : null),
                }}
                draggable={draggable}
                onDragStart={() => draggable && setDragFrom(linkedIdx)}
                onDragOver={(e) => {
                  if (draggable) e.preventDefault();
                }}
                onDrop={() => draggable && onDrop(linkedIdx)}
                onDragEnd={() => setDragFrom(null)}
              >
                <span
                  style={{ ...s.handle, ...(draggable ? null : s.handleDisabled) }}
                  aria-hidden
                >
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

      {previewPath && (
        <PreviewModal repoId={repoId} path={previewPath} onClose={() => setPreviewPath(null)} />
      )}
    </div>
  );
}
