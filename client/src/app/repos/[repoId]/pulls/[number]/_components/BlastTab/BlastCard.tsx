"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon } from "@devdigest/ui";
import type { BlastRadius } from "@devdigest/shared";
import { githubBlobUrl } from "@/lib/github-urls";
import { blastRows, blastCounts, type BlastRow } from "./helpers";
import { STATUS_LABEL, STATUS_COLOR, ENDPOINT_COLOR, CRON_COLOR } from "./constants";
import { s } from "./styles";

function SymbolRow({
  row,
  repoFullName,
  headSha,
}: {
  row: BlastRow;
  repoFullName: string | null;
  headSha: string;
}) {
  const t = useTranslations("prReview");
  const [open, setOpen] = React.useState(false);

  return (
    <div style={s.symbolRow}>
      <div style={s.symbolHeader} onClick={() => setOpen((o) => !o)}>
        <Icon.ChevronRight
          size={13}
          style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform 0.12s", flexShrink: 0 }}
        />
        <span className="mono" style={s.symbolName}>
          {row.symbol}
        </span>
        <span className="mono" style={s.symbolFile}>
          {row.file}
        </span>
        <span style={s.symbolCount}>{t("blast.callersCount", { count: row.impact.callers.length })}</span>
      </div>

      {open && (
        <div style={s.symbolBody}>
          {row.impact.callers.length === 0 ? (
            <p style={s.emptyBody}>{t("blast.noCallers")}</p>
          ) : (
            <div style={s.callerList}>
              {row.impact.callers.map((c, i) => (
                <a
                  key={i}
                  className="mono"
                  style={s.callerLink}
                  href={repoFullName ? githubBlobUrl(repoFullName, headSha, c.file, c.line) : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {c.file}:{c.line} — {c.name}
                </a>
              ))}
            </div>
          )}

          {(row.impact.endpoints_affected.length > 0 || row.impact.crons_affected.length > 0) && (
            <div style={s.badgeRow}>
              {row.impact.endpoints_affected.map((e) => (
                <Badge key={e} mono color={ENDPOINT_COLOR} bg="var(--bg-hover)" icon="Link">
                  {e}
                </Badge>
              ))}
              {row.impact.crons_affected.map((c) => (
                <Badge key={c} mono color={CRON_COLOR} bg="var(--bg-hover)" icon="Clock">
                  {c}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BlastCard({
  blast,
  repoFullName,
  headSha,
  onExplain,
  explaining,
}: {
  blast: BlastRadius;
  repoFullName: string | null;
  headSha: string;
  onExplain: () => void;
  explaining: boolean;
}) {
  const t = useTranslations("prReview");
  const counts = blastCounts(blast);
  const rows = blastRows(blast);

  return (
    <>
      <div style={s.headerRow}>
        <div style={s.headerLeft}>
          <span style={s.countsLine}>
            {t("blast.counts", {
              symbols: counts.symbols,
              callers: counts.callers,
              endpoints: counts.endpoints,
              crons: counts.crons,
            })}
          </span>
          <Badge dot bg="transparent" color={STATUS_COLOR[blast.status]}>
            {STATUS_LABEL[blast.status]}
          </Badge>
        </div>
        <div style={s.headerActions}>
          <div style={s.toggleGroup} role="group" aria-label={t("blast.viewToggle")}>
            <button type="button" style={s.toggleBtn(true)} disabled>
              {t("blast.tree")}
            </button>
            <button type="button" style={s.toggleBtn(false, true)} disabled title={t("blast.graphComingSoon")}>
              {t("blast.graphComingSoon")}
            </button>
          </div>
          <Button kind="secondary" size="sm" icon="Sparkles" loading={explaining} onClick={onExplain}>
            {explaining ? t("blast.explaining") : t("blast.explain")}
          </Button>
        </div>
      </div>

      {blast.summary && <p style={s.summaryBox}>{blast.summary}</p>}

      {rows.length === 0 ? (
        <p style={s.emptyBody}>{t("blast.empty")}</p>
      ) : (
        <div style={s.tree}>
          {rows.map((row) => (
            <SymbolRow key={`${row.file}:${row.symbol}`} row={row} repoFullName={repoFullName} headSha={headSha} />
          ))}
        </div>
      )}
    </>
  );
}
