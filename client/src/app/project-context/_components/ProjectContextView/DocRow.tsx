"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dropdown, Icon } from "@devdigest/ui";
import type { Agent, ContextDoc } from "@devdigest/shared";
import { s } from "./styles";
import { agentContextDeepLink } from "./helpers";

interface DocRowProps {
  doc: ContextDoc;
  usedByAgents: Agent[];
  active: boolean;
  onOpen: (path: string) => void;
}

/** One discovered doc row: full repo-relative path + "Used by N agents".
 * Clicking anywhere on the row selects it, showing its content in the
 * detail panel to the right. When N > 0 the "used by" count is itself a
 * clickable control listing the agents using it, each deep-linking into
 * that agent's Context tab (spec Edge cases) — its click is stopped from
 * also selecting the row. When N = 0 it's plain text — no control. */
export function DocRow({ doc, usedByAgents, active, onOpen }: DocRowProps) {
  const t = useTranslations("projectContext");
  const router = useRouter();
  const count = usedByAgents.length;

  return (
    <div
      style={active ? { ...s.row, ...s.rowActive } : s.row}
      onClick={() => onOpen(doc.path)}
      role="button"
      tabIndex={0}
    >
      <div style={s.rowPath}>
        <Icon.FileText size={14} style={s.rowIcon} />
        <span style={s.rowPathText} title={doc.path}>
          {doc.path}
        </span>
      </div>
      {count > 0 ? (
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown
            align="right"
            trigger={
              <button type="button" style={s.usedByBtn}>
                {t("row.usedBy", { count })}
              </button>
            }
            items={usedByAgents.map((a) => ({
              label: a.name,
              onClick: () => router.push(agentContextDeepLink(a.id, doc.path)),
            }))}
          />
        </div>
      ) : (
        <span style={s.usedByNone}>{t("row.notAttached")}</span>
      )}
    </div>
  );
}
