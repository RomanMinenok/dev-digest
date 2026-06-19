/* FindingsPopover — compact findings list shown on hover over SeverityChips.
   Rendered via portal into document.body so it escapes any overflow:hidden parent.
   Caller supplies top/left from getBoundingClientRect(). */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Icon } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";

const SEV_ICON: Record<string, React.ReactNode> = {
  CRITICAL: <Icon.AlertOctagon size={13} style={{ color: "var(--crit)", flexShrink: 0 }} />,
  WARNING: <Icon.AlertTriangle size={13} style={{ color: "var(--warn)", flexShrink: 0 }} />,
  SUGGESTION: <Icon.Lightbulb size={13} style={{ color: "var(--sugg)", flexShrink: 0 }} />,
};

const CAT_ICON: Record<string, React.ReactNode> = {
  bug: <Icon.Bug size={11} />,
  security: <Icon.Shield size={11} />,
  perf: <Icon.Zap size={11} />,
  style: <Icon.Code size={11} />,
  test: <Icon.FlaskConical size={11} />,
};

const MAX_SHOWN = 3;

type Props = {
  findings: FindingRecord[];
  /** Full count to show in header when findings is pre-sliced or we cap at MAX_SHOWN. */
  totalCount?: number;
  /** Viewport-relative position of the anchor (from getBoundingClientRect). */
  anchorTop: number;
  anchorLeft: number;
};

export function FindingsPopover({ findings, totalCount, anchorTop, anchorLeft }: Props) {
  if (findings.length === 0) return null;
  const total = totalCount ?? findings.length;
  const shown = findings.slice(0, MAX_SHOWN);

  const card = (
    <div
      style={{
        position: "fixed",
        top: anchorTop + 6,
        left: anchorLeft,
        zIndex: 9999,
        width: 360,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        padding: "10px 0 6px",
        pointerEvents: "none",
      }}
    >
      {/* header — no bottom divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 12px 8px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.07em",
          color: "var(--text-muted)",
          textTransform: "uppercase",
        }}
      >
        <Icon.Info size={12} style={{ color: "var(--text-muted)" }} />
        {total} {total === 1 ? "Finding" : "Findings"}
      </div>

      {/* finding rows — capped at MAX_SHOWN; full-width dividers between rows */}
      <div style={{ maxHeight: 340, overflowY: "auto" }}>
        {shown.map((f, i) => (
          <React.Fragment key={f.id}>
            {i > 0 && <div style={{ height: 1, background: "var(--border)", margin: "0 12px" }} />}
            <div
              style={{
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
            {/* row 1: icon + title + category */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
              {SEV_ICON[f.severity] ?? SEV_ICON.SUGGESTION}
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  flex: 1,
                  minWidth: 0,
                  lineHeight: 1.3,
                }}
              >
                {f.title}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10.5,
                  color: "var(--text-muted)",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {CAT_ICON[f.category]}
                {f.category}
              </span>
            </div>

            {/* row 2: file:line + confidence */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--accent-text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {f.file}:{f.start_line}
                {f.end_line !== f.start_line ? `-${f.end_line}` : ""}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background:
                      f.confidence >= 0.85
                        ? "var(--ok)"
                        : f.confidence >= 0.6
                        ? "var(--warn)"
                        : "var(--text-muted)",
                    flexShrink: 0,
                  }}
                />
                {Math.round(f.confidence * 100)}% conf
              </span>
            </div>

            {/* row 3: rationale excerpt */}
            <p
              style={{
                fontSize: 11.5,
                color: "var(--text-secondary)",
                margin: 0,
                lineHeight: 1.45,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {f.rationale}
            </p>
          </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(card, document.body);
}
