/* ModeSwitch — the Columns | Tabs segmented control (SPEC-05, T-25, AC-19).
   Pure controlled component: the parent owns `mode` state so both
   ResultsColumns (Columns pane) and, later, T-26's Tabs pane render off the
   same value without this component knowing about either. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { MODE_COLUMNS, MODE_TABS, type ResultsMode } from "../constants";
import { s } from "./styles";

export interface ModeSwitchProps {
  mode: ResultsMode;
  onChange: (mode: ResultsMode) => void;
}

export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  const t = useTranslations("multiAgent");
  return (
    <div style={s.wrap} role="group" aria-label={t("results.modeGroupLabel")}>
      <button
        type="button"
        style={mode === MODE_COLUMNS ? { ...s.button, ...s.buttonActive } : s.button}
        aria-pressed={mode === MODE_COLUMNS}
        onClick={() => onChange(MODE_COLUMNS)}
      >
        {t("results.modeColumns")}
      </button>
      <button
        type="button"
        style={mode === MODE_TABS ? { ...s.button, ...s.buttonActive } : s.button}
        aria-pressed={mode === MODE_TABS}
        onClick={() => onChange(MODE_TABS)}
      >
        {t("results.modeTabs")}
      </button>
    </div>
  );
}
