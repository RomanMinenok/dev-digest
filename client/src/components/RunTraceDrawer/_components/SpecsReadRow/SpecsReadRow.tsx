/* SpecsReadRow — one entry from trace.specs_read: shows the stored path,
   openable in a modal to show the exact stored `content` for THAT run (never
   a live re-read of the current file). A null `content` (unresolved at run
   time) renders as an unavailable/could-not-be-read state instead. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Modal } from "@devdigest/ui";
import { PromptModalBody } from "../PromptModalBody";

const pathButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  color: "var(--text-secondary)",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
  textDecorationStyle: "dashed",
  textUnderlineOffset: 2,
};

const unavailableStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  color: "var(--text-muted)",
};

export function SpecsReadRow({ spec }: { spec: { path: string; content: string | null } }) {
  const t = useTranslations("runs");
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  if (spec.content == null) {
    return (
      <span className="mono" style={unavailableStyle} title={t("trace.config.specUnavailable")}>
        <Icon.AlertTriangle size={11} />
        {spec.path}
      </span>
    );
  }

  const content = spec.content;
  const copy = () => {
    void navigator.clipboard?.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <>
      <button
        type="button"
        className="mono"
        style={pathButtonStyle}
        onClick={() => setOpen(true)}
        title={t("trace.config.openSpec")}
      >
        {spec.path}
      </button>
      {open && (
        <Modal
          width={1200}
          title={spec.path}
          onClose={() => setOpen(false)}
          footer={
            <Button kind="secondary" size="sm" icon={copied ? "Check" : "Copy"} onClick={copy}>
              {copied ? t("drawer.copied") : t("trace.prompt.copy")}
            </Button>
          }
        >
          <PromptModalBody text={content} />
        </Modal>
      )}
    </>
  );
}
