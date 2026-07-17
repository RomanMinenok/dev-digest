/* PrPicker — "Select a pull request…" combobox for the Configure-run screen
   (SPEC-05, T-24). There is no global "all pulls" endpoint (pulls are always
   fetched per-repo via GET /repos/:id/pulls), so this is a two-level picker:
   pick a repo, then a pull request within it. The trigger label resolves the
   currently selected PR (by id) via `usePullDetail`, independent of which
   repo is being browsed — so a page reload with `?pr=<id>` in the URL shows
   the right label without first re-selecting the repo. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { useRepos, usePulls, usePullDetail } from "@/lib/hooks";
import { s } from "./styles";

export interface PrPickerProps {
  /** Currently selected PR id, or null when none is chosen. */
  value: string | null;
  onChange: (prId: string) => void;
}

export function PrPicker({ value, onChange }: PrPickerProps) {
  const t = useTranslations("multiAgent");
  const [open, setOpen] = React.useState(false);
  const [browsingRepoId, setBrowsingRepoId] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  const { data: repos } = useRepos();
  const { data: pulls } = usePulls(browsingRepoId);
  const { data: selectedPr } = usePullDetail(value);

  React.useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setBrowsingRepoId(null);
      }
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
    setBrowsingRepoId(null);
  };

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
          {browsingRepoId === null ? (
            <div style={s.section}>
              <div style={s.sectionLabel}>{t("configure.prPicker.repository")}</div>
              {(repos ?? []).length === 0 ? (
                <div style={s.rowMuted}>{t("configure.prPicker.reposEmpty")}</div>
              ) : (
                (repos ?? []).map((repo) => (
                  <button key={repo.id} type="button" style={s.row} onClick={() => setBrowsingRepoId(repo.id)}>
                    <Icon.Folder size={14} />
                    {repo.full_name}
                    <span style={{ marginLeft: "auto" }}>
                      <Icon.ChevronRight size={14} />
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div style={s.section}>
              <button type="button" style={s.backRow} onClick={() => setBrowsingRepoId(null)}>
                <Icon.ChevronLeft size={13} />
                {t("configure.prPicker.backToRepos")}
              </button>
              <div style={s.divider} />
              <div style={s.sectionLabel}>{t("configure.prPicker.pullRequest")}</div>
              {(pulls ?? []).length === 0 ? (
                <div style={s.rowMuted}>{t("configure.prPicker.pullsEmpty")}</div>
              ) : (
                pulls!
                  .filter((pr) => !!pr.id)
                  .map((pr) => (
                    <button key={pr.id} type="button" style={s.row} onClick={() => pick(pr.id as string)}>
                      <Icon.GitPullRequest size={14} />
                      {t("configure.prPicker.item", { number: pr.number, title: pr.title })}
                    </button>
                  ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
