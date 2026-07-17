/* PrPicker — "Select a pull request…" combobox for the Configure-run screen
   (SPEC-05, T-24). Scoped to the globally selected repo (the top-left repo
   selector, via `useActiveRepo`) — there is no repo level in this picker.
   The trigger label resolves the currently selected PR (by id) via
   `usePullDetail`, independent of the active repo — so a page reload with
   `?pr=<id>` in the URL shows the right label, and switching repo leaves an
   already-picked PR selected rather than silently dropping it. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { usePulls, usePullDetail } from "@/lib/hooks";
import { useActiveRepo } from "@/lib/repo-context";
import { s } from "./styles";

export interface PrPickerProps {
  /** Currently selected PR id, or null when none is chosen. */
  value: string | null;
  onChange: (prId: string) => void;
}

export function PrPicker({ value, onChange }: PrPickerProps) {
  const t = useTranslations("multiAgent");
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const { repoId, reposLoaded } = useActiveRepo();
  const { data: pulls } = usePulls(repoId);
  const { data: selectedPr } = usePullDetail(value);

  React.useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const label = value
    ? selectedPr
      ? t("configure.prPicker.item", { number: selectedPr.number, title: selectedPr.title })
      : t("configure.prPicker.loading")
    : null;

  const pick = (prId: string) => {
    onChange(prId);
    setOpen(false);
  };

  const rows = (pulls ?? []).filter((pr) => !!pr.id);

  return (
    <div ref={ref} style={s.root}>
      <button type="button" style={s.trigger} onClick={() => setOpen((o) => !o)}>
        <Icon.GitPullRequest size={15} />
        <span style={{ ...s.triggerLabel, ...(label ? {} : s.triggerPlaceholder) }}>
          {label ?? t("configure.prPicker.placeholder")}
        </span>
        <Icon.ChevronDown size={14} />
      </button>

      {open && (
        <div style={s.panel}>
          <div style={s.section}>
            <div style={s.sectionLabel}>{t("configure.prPicker.pullRequest")}</div>
            {!reposLoaded ? (
              <div style={s.rowMuted}>{t("configure.prPicker.loading")}</div>
            ) : !repoId ? (
              <div style={s.rowMuted}>{t("configure.prPicker.reposEmpty")}</div>
            ) : rows.length === 0 ? (
              <div style={s.rowMuted}>{t("configure.prPicker.pullsEmpty")}</div>
            ) : (
              rows.map((pr) => (
                <button key={pr.id} type="button" style={s.row} onClick={() => pick(pr.id as string)}>
                  <Icon.GitPullRequest size={14} />
                  {t("configure.prPicker.item", { number: pr.number, title: pr.title })}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
