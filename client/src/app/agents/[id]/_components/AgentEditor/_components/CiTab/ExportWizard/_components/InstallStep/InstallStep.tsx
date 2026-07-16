"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { CI_SETUP_DOCS_URL, INSTALL_METHODS, type InstallMethod } from "./constants";
import { s } from "./styles";

export interface InstallStepProps {
  repoFullName: string;
  fileCount: number;
  method: InstallMethod;
  onMethodChange: (method: InstallMethod) => void;
  pendingAction: InstallMethod | null;
  error: string | null;
  successPrUrl: string | null;
  zipDownloaded: boolean;
}

/** Step 4 — choose open-PR vs zip download; surfaces export outcome (AC-3, AC-23, AC-24). */
export function InstallStep({
  repoFullName,
  fileCount,
  method,
  onMethodChange,
  pendingAction,
  error,
  successPrUrl,
  zipDownloaded,
}: InstallStepProps) {
  const t = useTranslations("ci");

  return (
    <div style={s.stack}>
      {INSTALL_METHODS.map((card) => {
        const selected = method === card.id;
        const pending = pendingAction === card.id;
        const CardIcon = Icon[card.icon];

        return (
          <button
            key={card.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={pendingAction != null}
            style={{
              ...s.methodCard,
              ...(selected ? s.methodCardSelected : null),
              ...(pending ? s.methodCardPending : null),
            }}
            onClick={() => onMethodChange(card.id)}
          >
            <div style={s.methodHeader}>
              <div
                style={{
                  ...s.methodIconWrap,
                  ...(selected ? s.methodIconWrapSelected : null),
                }}
              >
                <CardIcon
                  size={16}
                  color={selected ? "#fff" : "var(--text-secondary)"}
                />
              </div>
              <div style={s.methodTitleRow}>
                <span style={s.methodTitle}>
                  {card.id === "open_pr"
                    ? t("exportWizard.installCardTitle")
                    : t("exportWizard.installZipCardTitle")}
                </span>
                {card.recommended ? (
                  <span style={s.recommendedBadge}>{t("exportWizard.recommended")}</span>
                ) : null}
                {card.id === "files" ? (
                  <span style={s.methodHint}>{t("exportWizard.installZipCardHint")}</span>
                ) : null}
              </div>
            </div>
            {card.id === "open_pr" ? (
              <p style={s.methodDesc}>
                {t("exportWizard.installCardBodyBefore")}{" "}
                <strong style={s.repoStrong}>{repoFullName}</strong>{" "}
                {t("exportWizard.installCardBodyAfter", { count: fileCount })}
              </p>
            ) : null}
          </button>
        );
      })}

      <p style={s.helpRow}>
        {t("exportWizard.installHelpPrefix")}{" "}
        <a
          href={CI_SETUP_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={s.helpLink}
        >
          {t("exportWizard.installHelpLink")} →
        </a>
      </p>

      {error ? (
        <div style={{ ...s.feedback, ...s.error }} role="alert">
          {error}
        </div>
      ) : null}

      {successPrUrl ? (
        <div style={{ ...s.feedback, ...s.success }} role="status">
          {t("exportWizard.installSuccessPr")}{" "}
          <a
            href={successPrUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={s.successLink}
          >
            {t("publishDialog.openPr")}
          </a>
        </div>
      ) : null}

      {zipDownloaded ? (
        <div style={{ ...s.feedback, ...s.success }} role="status">
          {t("exportWizard.installSuccessZip")}
        </div>
      ) : null}
    </div>
  );
}
