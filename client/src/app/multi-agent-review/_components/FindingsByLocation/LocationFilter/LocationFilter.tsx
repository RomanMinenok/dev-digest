/* LocationFilter — the four-state All/Matched/Divergent/Agreed control for
   the "Findings by location" matrix (SPEC-05, T-27, AC-38/AC-39). Pure
   controlled component, mirrors ResultsColumns/ModeSwitch's shape: the
   parent owns the active filter, this only renders it. Replaces the mock's
   two-state "Show only conflicts" toggle. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FILTER_MESSAGE_KEY, FILTER_ORDER, type LocationFilter as LocationFilterValue } from "../constants";
import { s } from "./styles";

export interface LocationFilterProps {
  value: LocationFilterValue;
  counts: Record<LocationFilterValue, number>;
  onChange: (filter: LocationFilterValue) => void;
}

export function LocationFilter({ value, counts, onChange }: LocationFilterProps) {
  const t = useTranslations("multiAgent");
  return (
    <div style={s.wrap} role="group" aria-label={t("byLocation.filterGroupLabel")}>
      {FILTER_ORDER.map((filter) => (
        <button
          key={filter}
          type="button"
          style={value === filter ? { ...s.button, ...s.buttonActive } : s.button}
          aria-pressed={value === filter}
          onClick={() => onChange(filter)}
        >
          {t(FILTER_MESSAGE_KEY[filter], { count: counts[filter] })}
        </button>
      ))}
    </div>
  );
}
