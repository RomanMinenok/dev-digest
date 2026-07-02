"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Button, ProgressBar } from "@devdigest/ui";
import type { Convention } from "./mock";
import { s } from "./styles";

function confidenceColor(pct: number): string {
  if (pct >= 85) return "var(--ok)";
  if (pct >= 70) return "var(--warn)";
  return "var(--crit)";
}

export function ConventionCard({
  convention,
  githubFileBase,
  accepted,
  onAccept,
  onReject,
  onEditSave,
}: {
  convention: Convention;
  githubFileBase?: string;
  accepted: boolean;
  onAccept: () => void;
  onReject: () => void;
  onEditSave: (title: string) => void;
}) {
  const t = useTranslations("conventions");
  const [copied, setCopied] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(convention.title);

  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(convention.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [convention.code]);

  const startEditing = () => {
    setDraft(convention.title);
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft(convention.title);
    setEditing(false);
  };

  const saveEditing = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== convention.title) {
      onEditSave(trimmed);
    }
    setEditing(false);
  };

  return (
    <div style={s.card}>
      <div style={s.cardLeft}>
        {editing ? (
          <div style={s.titleEditWrap}>
            <textarea
              style={s.titleTextarea}
              value={draft}
              autoFocus
              rows={2}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEditing();
                } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  saveEditing();
                }
              }}
            />
            <div style={s.titleEditActions}>
              <Button kind="primary" size="sm" onClick={saveEditing}>
                {t("card.save")}
              </Button>
              <Button kind="secondary" size="sm" onClick={cancelEditing}>
                {t("card.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <p
            style={s.cardTitle}
            role="button"
            tabIndex={0}
            title={t("card.editTitle")}
            onClick={startEditing}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                startEditing();
              }
            }}
          >
            {convention.title}
          </p>
        )}

        <div style={s.codeBlock}>
          <div style={s.codeHeader}>
            {githubFileBase ? (
              <a
                href={`${githubFileBase}/${convention.file}`}
                target="_blank"
                rel="noopener noreferrer"
                style={s.codeFileLink}
              >
                {convention.file}
              </a>
            ) : (
              <span style={s.codeFilePath}>{convention.file}</span>
            )}
            <button style={s.copyBtn} onClick={handleCopy} title="Copy code">
              {copied ? <Icon.Check size={13} /> : <Icon.Copy size={13} />}
            </button>
          </div>
          <pre style={s.codeBody}>{convention.code}</pre>
        </div>

        <div style={s.confidenceRow}>
          <span style={s.confidenceLabel}>{t("card.confidence")}</span>
          <div style={s.confidenceBar}>
            <div
              style={{
                width: `${convention.confidence}%`,
                height: "100%",
                background: confidenceColor(convention.confidence),
                borderRadius: 99,
                transition: "width .4s ease",
              }}
            />
          </div>
          <span style={s.confidencePct}>{convention.confidence}%</span>
        </div>
      </div>

      <div style={s.cardActions}>
        <Button
          kind={accepted ? "primary" : "secondary"}
          size="sm"
          icon="Check"
          onClick={onAccept}
          style={{ minWidth: 110 }}
        >
          {t("card.accepted")}
        </Button>
        <Button
          kind="secondary"
          size="sm"
          icon="X"
          onClick={onReject}
          style={{
            minWidth: 110,
            color: "var(--text-muted)",
          }}
        >
          {t("card.reject")}
        </Button>
      </div>
    </div>
  );
}
