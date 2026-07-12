/* PrBriefCard — the PR Brief summary card for the Overview tab. Lazy-computes
   on mount via usePrBrief (GET is the trigger, `null` means "not yet
   computed"); Recompute always forces a fresh generation.
   Single render path: card chrome (title/border) is constant, only the inner
   content varies across loading/unavailable/loaded/error (see
   client/INSIGHTS.md "Early-return branches that replace the full page
   layout … break chrome" — same rule applied here as in IntentCard).
   The verdict+score header and findings count are a *display* of the
   already-fetched latest review session (usePrReviews, the same
   `["reviews", prId]` query ReviewRunAccordion/VerdictBanner use) — derived
   client-side, never recomputed or re-fetched here. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Skeleton, SectionLabel } from "@devdigest/ui";
import type { Verdict } from "@devdigest/shared";
import { usePrBrief, useRecomputeBrief } from "../../../../../../../lib/hooks/brief";
import { usePrReviews } from "../../../../../../../lib/hooks/reviews";
import { VERDICT_META } from "../VerdictBanner/constants";
import { formatTokens, formatCost } from "../RunTraceDrawer/helpers";
import { s } from "./styles";

interface PrBriefCardProps {
  prId: string | null | undefined;
  /** Accepted for T15/T16 (Risk Areas / Review Focus GitHub deep-links) — not
      used by this card yet; kept in the prop shape so callers don't need to
      change when those tasks land. */
  repoFullName?: string | null;
  headSha?: string | null;
}

export function PrBriefCard({ prId }: PrBriefCardProps) {
  const t = useTranslations("brief");
  const tVerdict = useTranslations("prReview");
  const { data: brief, isLoading } = usePrBrief(prId);
  const { data: reviews } = usePrReviews(prId);
  const recompute = useRecomputeBrief(prId ?? "");

  const busy = recompute.isPending;
  const latestReview = reviews && reviews.length > 0 ? reviews[0] : null;
  const hasCompletedSession = !!latestReview;
  const meta = latestReview?.verdict
    ? (VERDICT_META[latestReview.verdict as Verdict] ?? VERDICT_META.comment)
    : null;
  const VIcon = meta ? Icon[meta.icon] : null;
  const blockers = latestReview
    ? latestReview.findings.filter((f) => f.severity === "CRITICAL" && !f.dismissed_at).length
    : 0;

  const hasCostInfo =
    brief != null && (brief.tokens_in != null || brief.tokens_out != null || brief.cost_usd != null);

  return (
    <div style={s.wrap}>
      <div style={s.headerRow}>
        <SectionLabel icon="FileText">{t("title")}</SectionLabel>
        {(brief != null || hasCompletedSession) && (
          <Button
            kind="secondary"
            size="sm"
            icon="RefreshCw"
            loading={busy}
            disabled={!prId}
            onClick={() => recompute.mutate()}
          >
            {busy ? t("regenerating") : t("regenerate")}
          </Button>
        )}
      </div>

      {isLoading && (
        <div
          role="status"
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <Skeleton height={14} width="80%" />
          <Skeleton height={14} width="60%" />
        </div>
      )}

      {!isLoading && brief == null && (
        <div>
          <p style={s.emptyBody}>{t("unavailable")}</p>
          <p style={s.emptyBody}>{t("unavailableHint")}</p>
        </div>
      )}

      {!isLoading && brief != null && (
        <>
          {meta && VIcon && (
            <div style={s.verdictRow}>
              <div style={s.iconBox(meta.bg, meta.c)}>
                <VIcon size={16} />
              </div>
              <span style={s.verdictLabel(meta.c)}>{tVerdict(`verdict.${meta.labelKey}`)}</span>
              <span style={s.emptyBody}>
                {tVerdict("verdict.findingsCount", { count: latestReview!.findings.length })}
                {blockers > 0 ? tVerdict("verdict.blockers", { count: blockers }) : ""}
              </span>
              {latestReview!.score != null && (
                <span className="mono" style={s.emptyBody}>
                  {tVerdict("verdict.prScore")} {latestReview!.score}
                </span>
              )}
            </div>
          )}

          {hasCostInfo && (
            <div style={s.briefCostBadge}>
              <Icon.Cpu size={11} />
              {t("cost")}:{" "}
              {brief.tokens_in != null && brief.tokens_out != null
                ? formatTokens(brief.tokens_in, brief.tokens_out)
                : "—"}
              {" · "}
              {formatCost(brief.cost_usd)}
            </div>
          )}

          <div>
            <div style={s.sectionTitle}>{t("block.what")}</div>
            <p style={s.paragraph}>{brief.what}</p>
          </div>

          <div>
            <div style={s.sectionTitle}>{t("block.why")}</div>
            <p style={s.paragraph}>{brief.why}</p>
          </div>
        </>
      )}

      {recompute.isError && (
        <p style={s.errorText}>
          {t("error")}{" "}
          <Button kind="ghost" size="sm" onClick={() => recompute.mutate()}>
            {t("retry")}
          </Button>
        </p>
      )}
    </div>
  );
}
