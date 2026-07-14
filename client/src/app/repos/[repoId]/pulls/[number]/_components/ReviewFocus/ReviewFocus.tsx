/* ReviewFocus — full-width section listing `review_focus: ReviewFocusItem[]`
   from the PR Brief (`@devdigest/shared`). Sits in the tab's vertical stack
   alongside other full-width sections (see OverviewTab's `Description`
   section, which also renders a bare `SectionLabel` + body rather than a
   card `wrap`) — not a card inside a two-column row. Each item links to its
   file+line-range on GitHub via `githubBlobUrl`'s 4-arg (line-range) form,
   since `ReviewFocusItem` carries `start_line`/`end_line` (Risk Areas use the
   same shape via `RiskFileRef`).
   Reuses `RISK_SEVERITY_COLOR` from `IntentCard/constants.ts` — both
   features key off the same `RiskSeverity` type, so the color map lives in
   one place. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SectionLabel } from "@devdigest/ui";
import type { ReviewFocusItem } from "@devdigest/shared";
import { githubBlobUrl } from "@/lib/github-urls";
import { RISK_SEVERITY_COLOR } from "../IntentCard/constants";
import { s } from "./styles";

interface ReviewFocusProps {
  reviewFocus: ReviewFocusItem[];
  repoFullName: string;
  headSha: string;
}

export function ReviewFocus({ reviewFocus, repoFullName, headSha }: ReviewFocusProps) {
  const t = useTranslations("brief");

  return (
    <section>
      <SectionLabel icon="Eye">{t("reviewFocus")}</SectionLabel>
      <div style={s.wrap}>
        {reviewFocus.length === 0 ? (
          <p style={s.emptyBody}>{t("noReviewFocus")}</p>
        ) : (
          reviewFocus.map((item, i) => (
            <ReviewFocusRow key={i} item={item} repoFullName={repoFullName} headSha={headSha} />
          ))
        )}
      </div>
    </section>
  );
}

function ReviewFocusRow({
  item,
  repoFullName,
  headSha,
}: {
  item: ReviewFocusItem;
  repoFullName: string;
  headSha: string;
}) {
  const lineLabel = item.end_line != null && item.end_line !== item.start_line
    ? `${item.path}:${item.start_line}-${item.end_line}`
    : `${item.path}:${item.start_line}`;

  return (
    <div style={s.itemRow}>
      <div style={s.itemIcon(RISK_SEVERITY_COLOR[item.severity])}>
        <Icon.AlertTriangle size={14} />
      </div>
      <div style={s.itemBody}>
        <span style={s.itemDescription}>{item.description}</span>
        <a
          className="mono"
          style={s.itemLink}
          href={githubBlobUrl(repoFullName, headSha, item.path, item.start_line, item.end_line)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {lineLabel}
        </a>
      </div>
    </div>
  );
}
