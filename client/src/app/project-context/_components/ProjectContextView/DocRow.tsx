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
}

/** One discovered doc row: full repo-relative path + "Used by N agents".
 * When N > 0 the count is itself a clickable control listing the agents
 * using it, each deep-linking into that agent's Context tab (spec Edge
 * cases). When N = 0 it's plain text — no control. */
export function DocRow({ doc, usedByAgents }: DocRowProps) {
  const t = useTranslations("projectContext");
  const router = useRouter();
  const count = usedByAgents.length;

  return (
    <div style={s.row}>
      <div style={s.rowPath}>
        <Icon.FileText size={14} style={s.rowIcon} />
        <span style={s.rowPathText} title={doc.path}>
          {doc.path}
        </span>
      </div>
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
            onClick: () => router.push(agentContextDeepLink(a.id, doc.path)),
          }))}
        />
      ) : (
        <span style={s.usedByNone}>{t("row.notAttached")}</span>
      )}
    </div>
  );
}
