/* IntentCard — the PR's declared intent (in/out-of-scope) plus a Risk Areas
   block, at the top of the Overview tab. Lazy-computes on mount via
   usePrIntent (GET is the trigger); Recompute always forces a fresh
   classification. `risks` is passed in from the parent's already-fetched
   PrBrief (see PrBriefCard) — this component does not fetch it itself.
   Single render path: card chrome (title/border) is constant, only the inner
   content varies across loading/empty/error/loaded (see client/INSIGHTS.md
   "Early-return branches that replace the full page layout … break chrome").
   The Risk Areas block below is a new section within that same render tree,
   not a new early-return branch. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Skeleton, SectionLabel } from "@devdigest/ui";
import type { Risk } from "@devdigest/shared";
import { githubBlobUrl } from "@/lib/github-urls";
import { usePrIntent, useRecomputeIntent } from "../../../../../../../lib/hooks/intent";
import { SOURCE_ICON, RISK_SEVERITY_COLOR, riskKindIcon } from "./constants";
import { s } from "./styles";

interface IntentCardProps {
  prId: string | null | undefined;
  risks: Risk[];
  repoFullName: string;
  headSha: string;
}

export function IntentCard({ prId, risks, repoFullName, headSha }: IntentCardProps) {
  const t = useTranslations("prReview");
  const tBrief = useTranslations("brief");
  const { data: intent, isLoading, isError, refetch } = usePrIntent(prId);
  const recompute = useRecomputeIntent(prId);

  const busy = recompute.isPending;

  return (
    <div style={s.wrap}>
      <div style={s.headerRow}>
        <SectionLabel icon="Target">{t("intent.title")}</SectionLabel>
        <Button
          kind="secondary"
          size="sm"
          icon="RefreshCw"
          loading={busy}
          disabled={!prId}
          aria-label={t("intent.recomputeAriaLabel")}
          onClick={() => recompute.mutate()}
        >
          {busy ? t("intent.recomputing") : t("intent.recompute")}
        </Button>
      </div>

      {isLoading && (
        <div
          role="status"
          aria-label={t("intent.loading")}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <Skeleton height={14} width="80%" />
          <Skeleton height={14} width="60%" />
        </div>
      )}

      {!isLoading && isError && (
        <p style={s.emptyBody}>
          {t("intent.error")}{" "}
          <Button kind="ghost" size="sm" onClick={() => refetch()}>
            {t("intent.retry")}
          </Button>
        </p>
      )}

      {!isLoading && !isError && !intent && <p style={s.emptyBody}>{t("intent.empty")}</p>}

      {!isLoading && !isError && intent && (
        <>
          <p style={s.sentence}>{intent.intent}</p>

          <div style={s.scopeGrid}>
            <div style={s.scopeCol}>
              <span style={s.scopeLabel}>
                <Icon.ListChecks size={12} />
                {t("intent.inScope")}
              </span>
              <ul style={s.scopeList}>
                {intent.in_scope.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
            <div style={s.scopeCol}>
              <span style={s.scopeLabel}>
                <Icon.Slash size={12} />
                {t("intent.outOfScope")}
              </span>
              <ul style={s.scopeList}>
                {intent.out_of_scope.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {intent.model && (
            <div style={s.metaRow}>
              <Icon.Cpu size={12} />
              {t("intent.computedBy", { model: intent.model, time: formatUpdatedAt(intent.updated_at) })}
            </div>
          )}

          {intent.sources && intent.sources.length > 0 && (
            <div style={s.sourcesRow}>
              <span>{t("intent.sources")}</span>
              {intent.sources.map((src, i) => {
                const SrcIcon = Icon[SOURCE_ICON[src.type]];
                return (
                  <span key={i} style={s.sourceItem(src.included)}>
                    <SrcIcon size={11} />
                    {src.ref}
                  </span>
                );
              })}
            </div>
          )}
        </>
      )}

      <div style={s.risksSection}>
        <span style={s.risksTitle}>{tBrief("riskAreas")}</span>
        {risks.length === 0 ? (
          <p style={s.emptyBody}>{tBrief("noRiskAreas")}</p>
        ) : (
          risks.map((risk, i) => <RiskRow key={i} risk={risk} repoFullName={repoFullName} headSha={headSha} />)
        )}
      </div>
    </div>
  );
}

function RiskRow({ risk, repoFullName, headSha }: { risk: Risk; repoFullName: string; headSha: string }) {
  const RiskIcon = Icon[riskKindIcon(risk.kind)];
  return (
    <div style={s.riskRow}>
      <div style={s.riskIcon(RISK_SEVERITY_COLOR[risk.severity])}>
        <RiskIcon size={14} />
      </div>
      <div style={s.riskBody}>
        <span style={s.riskTitle}>{risk.title}</span>
        {risk.file_refs.length > 0 && (
          <div style={s.riskRefs}>
            {risk.file_refs.map((file) => (
              <a
                key={file}
                className="mono"
                style={s.riskRefLink}
                href={githubBlobUrl(repoFullName, headSha, file)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {file}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Formats an ISO timestamp as a locale time string; falls back to the
    raw value (or empty) when absent/unparseable — no derived state needed. */
function formatUpdatedAt(updatedAt: string | null | undefined): string {
  if (!updatedAt) return "";
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return updatedAt;
  return d.toLocaleString();
}
