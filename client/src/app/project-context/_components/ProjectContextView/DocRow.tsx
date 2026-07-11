"use client";

import { Icon } from "@devdigest/ui";
import type { ContextDoc } from "@devdigest/shared";
import { s } from "./styles";
import { docRootLabel, docRootBadgeColor, docFileName, docDirName } from "./helpers";

interface DocRowProps {
  doc: ContextDoc;
  active: boolean;
  onOpen: (path: string) => void;
}

/** One discovered doc row: filename (bold) with its directory below, and a
 * colored root-folder badge on the right. Clicking anywhere on the row
 * selects it, showing its content in the detail panel to the right — where
 * the "Used by N agents" control now lives (moved out of the row). The file
 * icon turns blue when the row is the active selection. */
export function DocRow({ doc, active, onOpen }: DocRowProps) {
  const rootLabel = docRootLabel(doc.path);
  const badgeColor = docRootBadgeColor(rootLabel);

  return (
    <div
      style={active ? { ...s.row, ...s.rowActive } : s.row}
      onClick={() => onOpen(doc.path)}
      role="button"
      tabIndex={0}
    >
      <div style={s.rowPath}>
        <Icon.FileText size={14} style={active ? s.rowIconActive : s.rowIcon} />
        <div style={s.rowMain}>
          <span style={s.rowFileName} title={doc.path}>
            {docFileName(doc.path)}
          </span>
          <span style={s.rowDirText}>{docDirName(doc.path)}</span>
        </div>
      </div>
      <span style={{ ...s.rootBadge, background: badgeColor.bg, color: badgeColor.fg }}>
        {rootLabel}
      </span>
    </div>
  );
}
