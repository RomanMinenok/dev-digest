"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { CiTarget } from "@devdigest/shared";
import { TARGET_CARDS } from "../../constants";
import { s } from "../../styles";

export interface TargetStepProps {
  target: CiTarget;
  onSelectTarget: (target: CiTarget) => void;
}

/** Step 1 presenter — CI target selection grid (AC-2). */
export function TargetStep({ target, onSelectTarget }: TargetStepProps) {
  const t = useTranslations("ci");

  return (
    <div style={s.targetGrid} role="radiogroup" aria-label={t("exportWizard.steps.target")}>
      {TARGET_CARDS.map((card) => {
        const selected = !card.disabled && target === card.id;
        const TargetIcon = Icon[card.icon];
        const descKey = `exportWizard.targets.${card.id}Desc` as const;

        return (
          <button
            key={card.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={card.disabled}
            aria-disabled={card.disabled}
            style={{
              ...s.targetCard,
              ...(selected ? s.targetCardSelected : null),
              ...(card.disabled ? s.targetCardDisabled : null),
            }}
            onClick={() => {
              if (!card.disabled) onSelectTarget(card.id);
            }}
          >
            <div style={s.targetCardHeader}>
              <div
                style={{
                  ...s.targetIconWrap,
                  ...(selected ? s.targetIconWrapSelected : null),
                }}
              >
                <TargetIcon size={16} color={selected ? "#fff" : "var(--text-secondary)"} />
              </div>
              <div style={s.targetLabelRow}>
                <span style={s.targetLabel}>{t(`exportWizard.targets.${card.id}`)}</span>
                {card.recommended ? (
                  <span style={s.recommendedBadge}>{t("exportWizard.recommended")}</span>
                ) : null}
              </div>
            </div>
            <p
              style={{
                ...s.targetDesc,
                ...(card.id === "cli" ? s.targetDescMono : null),
              }}
            >
              {t(descKey)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
