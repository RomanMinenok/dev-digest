"use client";

import React from "react";
import { Icon } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { FindingsPopover } from "../FindingsPopover/FindingsPopover";

const SEV_DEF = [
  {
    key: "critical" as const,
    icon: <Icon.AlertOctagon size={12} />,
    color: "var(--crit)",
  },
  {
    key: "warning" as const,
    icon: <Icon.AlertTriangle size={12} />,
    color: "var(--warn)",
  },
  {
    key: "suggestion" as const,
    icon: <Icon.Lightbulb size={12} />,
    color: "var(--sugg)",
  },
];

type Props = {
  critical?: number | null;
  warning?: number | null;
  suggestion?: number | null;
  /** If true, underlines the counts to signal hover interactivity. */
  interactive?: boolean;
  /** When provided, hovering the chips shows a findings popover. */
  findings?: FindingRecord[];
  /** Total finding count for the popover header (defaults to findings.length). */
  findingsTotal?: number;
  /** Extra style on the outer wrapper. */
  style?: React.CSSProperties;
};

export function SeverityChips({
  critical,
  warning,
  suggestion,
  interactive,
  findings,
  findingsTotal,
  style,
}: Props) {
  const [hovered, setHovered] = React.useState(false);
  const [anchor, setAnchor] = React.useState<{ top: number; left: number } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  const counts = { critical: critical ?? 0, warning: warning ?? 0, suggestion: suggestion ?? 0 };
  const hasAny = counts.critical > 0 || counts.warning > 0 || counts.suggestion > 0;

  if (!hasAny) {
    return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>;
  }

  const showPopover = hovered && findings && findings.length > 0;

  function handleMouseEnter() {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setAnchor({ top: r.bottom, left: r.left });
    }
    setHovered(true);
  }

  function handleMouseLeave() {
    setHovered(false);
    setAnchor(null);
  }

  return (
    <div
      ref={ref}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "nowrap", ...style }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {SEV_DEF.map(({ key, icon, color }) => {
        const n = counts[key];
        if (n === 0) return null;
        return (
          <span
            key={key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              color,
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
              ...(interactive
                ? {
                    borderBottom: `1px dotted ${color}`,
                    paddingBottom: 2,
                    cursor: "default",
                  }
                : {}),
            }}
          >
            {icon}
            {n}
          </span>
        );
      })}
      {showPopover && anchor && (
        <FindingsPopover
          findings={findings!}
          totalCount={findingsTotal}
          anchorTop={anchor.top}
          anchorLeft={anchor.left}
        />
      )}
    </div>
  );
}
