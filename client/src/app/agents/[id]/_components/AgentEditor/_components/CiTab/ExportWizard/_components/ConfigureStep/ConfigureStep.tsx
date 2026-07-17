"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import {
  EXPECTED_SECRETS,
  POST_AS_OPTIONS,
  TRIGGER_OPTIONS,
  type ExpectedSecretStatus,
  type PostAsId,
  type TriggerId,
} from "./constants";
import { s } from "./styles";

export interface ConfigureStepProps {
  triggers: string[];
  postAs: PostAsId;
  onTriggersChange: (triggers: string[]) => void;
  onPostAsChange: (postAs: PostAsId) => void;
}

const SECRET_STATUS_COLOR: Record<ExpectedSecretStatus, string> = {
  not_set: "var(--warn)",
  ready: "var(--ok)",
};

/** Step 3 — triggers, static secrets table, post target (AC-11/12/13). */
export function ConfigureStep({
  triggers,
  postAs,
  onTriggersChange,
  onPostAsChange,
}: ConfigureStepProps) {
  const t = useTranslations("ci");

  const toggleTrigger = (id: TriggerId) => {
    const next = triggers.includes(id)
      ? triggers.filter((value) => value !== id)
      : [...triggers, id];
    if (next.length === 0) return;
    onTriggersChange(next);
  };

  return (
    <div style={s.stack}>
      <section style={s.section} aria-labelledby="export-trigger-label">
        <div id="export-trigger-label" style={s.sectionLabel}>
          {t("exportWizard.triggerLabel")}
        </div>
        <div style={s.chipRow} role="group" aria-label={t("exportWizard.triggerLabel")}>
          {TRIGGER_OPTIONS.map((option) => {
            const active = triggers.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                style={{
                  ...s.chip,
                  ...(active ? s.chipActive : null),
                }}
                aria-pressed={active}
                onClick={() => toggleTrigger(option.id)}
              >
                {active ? <Icon.Check size={12} color="var(--accent)" /> : null}
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <section style={s.section} aria-labelledby="export-secrets-label">
        <div id="export-secrets-label" style={s.sectionLabel}>
          {t("exportWizard.secrets.label")}
        </div>
        <div style={s.secretsTable} role="table" aria-label={t("exportWizard.secrets.label")}>
          {EXPECTED_SECRETS.map((secret, index) => {
            const statusColor = SECRET_STATUS_COLOR[secret.status];
            const isLast = index === EXPECTED_SECRETS.length - 1;
            return (
              <div
                key={secret.name}
                style={{
                  ...s.secretRow,
                  ...(isLast ? s.secretRowLast : null),
                }}
                role="row"
              >
                <span style={s.secretName} role="cell">
                  {secret.name}
                </span>
                <span style={s.secretDesc} role="cell">
                  {t(`exportWizard.secrets.${secret.descriptionKey}`)}
                </span>
                <span
                  style={{ ...s.secretStatus, color: statusColor }}
                  role="cell"
                  aria-label={t(`exportWizard.secrets.status.${secret.status}`)}
                >
                  <span
                    style={{ ...s.secretStatusDot, background: statusColor }}
                    aria-hidden
                  />
                  {t(`exportWizard.secrets.status.${secret.status}`)}
                </span>
              </div>
            );
          })}
        </div>
        <p style={s.secretsHint}>{t("exportWizard.secrets.hint")}</p>
      </section>

      <section style={s.section} aria-labelledby="export-post-as-label">
        <div id="export-post-as-label" style={s.sectionLabel}>
          {t("exportWizard.postResultsLabel")}
        </div>
        <div style={s.radioGroup} role="radiogroup" aria-label={t("exportWizard.postResultsLabel")}>
          {POST_AS_OPTIONS.map((option) => {
            const checked = postAs === option.id;
            return (
              <label key={option.id} style={s.radioRow}>
                <input
                  type="radio"
                  name="export-post-as"
                  checked={checked}
                  onChange={() => onPostAsChange(option.id)}
                />
                <span>{t(`exportWizard.postAs.${option.labelKey}`)}</span>
                {"recommended" in option && option.recommended ? (
                  <span style={s.recommendedBadge}>{t("exportWizard.recommended")}</span>
                ) : null}
              </label>
            );
          })}
        </div>
      </section>

      <div style={s.callout} role="note">
        <Icon.Info size={15} style={s.calloutIcon} />
        <p>
          {t("exportWizard.blockMergeCallout.prefix")}
          <strong style={s.calloutStrong}>{t("exportWizard.blockMergeCallout.failCiOn")}</strong>
          {t("exportWizard.blockMergeCallout.middle")}
          <strong style={s.calloutStrong}>
            {t("exportWizard.blockMergeCallout.requiredStatusCheck")}
          </strong>
          {t("exportWizard.blockMergeCallout.suffix")}
        </p>
      </div>
    </div>
  );
}
