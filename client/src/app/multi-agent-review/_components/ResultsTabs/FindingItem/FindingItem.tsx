/* FindingItem — one expandable finding card in the Tabs results view
   (SPEC-05, T-26, AC-21/AC-22/AC-23). Collapsed: severity + title +
   file:line + category. Expanded: confidence, rationale + suggested fix
   (agent-authored prose through the shared, already-safe `Markdown`
   renderer — never `dangerouslySetInnerHTML`), and **exactly three**
   actions — Accept, Dismiss, "Turn into eval case". No `Learn`, no
   "Reply to author" — not disabled, not present, in any state (AC-22). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, CategoryTag, ConfidenceNum, Icon, Markdown, SeverityBadge, type Category, type Severity } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { findingIconColor, s } from "./styles";

export interface FindingItemProps {
  finding: FindingRecord;
  defaultExpanded?: boolean;
  pending?: boolean;
  onAction: (action: "accept" | "dismiss") => void;
  /** Handler to turn this finding into an eval case. Absent when the owning
   *  agent no longer exists in the workspace (fail-closed: button disabled). */
  onTurnIntoEvalCase?: () => void;
}

export function FindingItem({ finding, defaultExpanded, pending, onAction, onTurnIntoEvalCase }: FindingItemProps) {
  const t = useTranslations("multiAgent");
  // Accept/Dismiss/Suggested fix/Turn into eval case are reused verbatim
  // from the existing "prReview" namespace rather than duplicated under new
  // keys (client/INSIGHTS.md: reuse across a second `useTranslations`
  // namespace instead of re-declaring the same string).
  const tPr = useTranslations("prReview");
  const [expanded, setExpanded] = React.useState(defaultExpanded ?? false);
  const sevColor = findingIconColor(finding.severity);
  const accepted = !!finding.accepted_at;
  const dismissed = !!finding.dismissed_at;
  const muted = accepted || dismissed;
  const evalCaseDisabled = !onTurnIntoEvalCase;

  return (
    <div style={s.card(sevColor, muted)}>
      <div onClick={() => setExpanded((e) => !e)} style={s.header}>
        <SeverityBadge severity={finding.severity as Severity} compact />
        <div style={s.headerMain}>
          <div style={s.titleRow}>
            <span style={s.title(muted, dismissed)}>{finding.title}</span>
            <CategoryTag category={finding.category as Category} />
            {accepted && <span style={s.acceptedTag}>{t("results.acceptedTag")}</span>}
            {dismissed && <span style={s.dismissedTag}>{t("results.dismissedTag")}</span>}
          </div>
          <div style={s.metaRow}>
            <span style={s.location}>
              {finding.file}:{finding.start_line}
            </span>
            <ConfidenceNum value={finding.confidence} />
          </div>
        </div>
        <Icon.ChevronDown size={16} style={s.chevron(expanded)} />
      </div>

      {expanded && (
        <div style={s.body}>
          <div style={s.prose}>
            <Markdown>{finding.rationale}</Markdown>
          </div>
          {finding.suggestion && (
            <div style={s.suggestionWrap}>
              <div style={s.suggestionLabel}>{tPr("finding.suggestedFix")}</div>
              <div style={s.prose}>
                <Markdown>{finding.suggestion}</Markdown>
              </div>
            </div>
          )}

          <div style={s.actions}>
            <Button kind="secondary" size="sm" icon="Check" disabled={pending} active={accepted} onClick={() => onAction("accept")}>
              {tPr("finding.accept")}
            </Button>
            <Button kind="ghost" size="sm" icon="X" disabled={pending} active={dismissed} onClick={() => onAction("dismiss")}>
              {tPr("finding.dismiss")}
            </Button>
            <Button
              kind="ghost"
              size="sm"
              icon="FlaskConical"
              disabled={evalCaseDisabled}
              title={evalCaseDisabled ? t("results.evalCaseAgentGone") : tPr("finding.turnIntoEvalCase")}
              aria-label={evalCaseDisabled ? t("results.evalCaseAgentGone") : tPr("finding.turnIntoEvalCase")}
              onClick={onTurnIntoEvalCase}
            >
              {tPr("finding.turnIntoEvalCase")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
