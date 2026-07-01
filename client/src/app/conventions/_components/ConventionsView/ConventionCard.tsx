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
}: {
  convention: Convention;
  githubFileBase?: string;
  accepted: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const t = useTranslations("conventions");
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(convention.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [convention.code]);

  return (
    <div style={s.card}>
      <div style={s.cardLeft}>
        <p style={s.cardTitle}>{convention.title}</p>

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
