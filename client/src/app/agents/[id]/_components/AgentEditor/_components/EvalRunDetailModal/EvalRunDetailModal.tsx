"use client";

/**
 * EvalRunDetailModal — read-only view of one eval case's latest run.
 *
 * Shows the score breakdown (recall/precision/citation + raw counts) and the
 * Expected vs Actual finding lists side by side, so a failed case ("expected 1,
 * got 2") can be diagnosed without a direct DB query. Every actual finding is
 * marked matched/unmatched against the expected list using the same coordinate
 * rule the server's scorer uses (file + intersecting line range).
 *
 * No trace (prompt assembly / tool calls / raw model output) is shown — eval
 * runs don't persist one (see client/INSIGHTS.md).
 */

import type { ReactElement } from "react";
import { useTranslations } from "next-intl";
import { Modal, Icon } from "@devdigest/ui";
import type { EvalCase, EvalRunRecord, Finding } from "@devdigest/shared";
import {
  matchesExpectation,
  parseActualFindings,
  parseExpectedFindings,
} from "../EvalsTab/helpers";
import { s } from "./styles";

export interface EvalRunDetailModalProps {
  evalCase: EvalCase;
  run: EvalRunRecord;
  onClose: () => void;
}

function pct(value: number | null): string {
  return value == null ? "—" : Math.round(value * 100) + "%";
}

function count(value: number | null): string {
  return value == null ? "—" : String(value);
}

function FindingRow({
  finding,
  matched,
}: {
  finding: { file: string; start_line: number; end_line: number; severity: string; category: string; title: string };
  matched: boolean | null;
}) {
  const loc =
    finding.start_line === finding.end_line
      ? `${finding.file}:${finding.start_line}`
      : `${finding.file}:${finding.start_line}-${finding.end_line}`;

  return (
    <div style={matched ? { ...s.findingRow, ...s.findingRowMatched } : s.findingRow}>
      {matched != null && (
        <span style={s.findingIcon}>
          {matched ? (
            <Icon.CheckCircle size={14} style={s.findingIconMatched} />
          ) : (
            <Icon.Dot size={14} style={s.findingIconUnmatched} />
          )}
        </span>
      )}
      <div style={s.findingBody}>
        <span style={s.findingLoc}>{loc}</span>
        <span style={s.findingTitle}>{finding.title}</span>
        <span style={s.findingMeta}>
          {finding.severity} · {finding.category}
        </span>
      </div>
    </div>
  );
}

export function EvalRunDetailModal({
  evalCase,
  run,
  onClose,
}: EvalRunDetailModalProps): ReactElement {
  const t = useTranslations("eval");

  const expected = parseExpectedFindings(evalCase.expected_output);
  const actual: Finding[] = parseActualFindings(run.actual_output);

  const passed = run.pass === true;

  const subtitleParts = [
    new Date(run.ran_at).toLocaleString(),
    run.duration_ms != null ? `${(run.duration_ms / 1000).toFixed(1)}s` : null,
    run.cost_usd != null ? `$${run.cost_usd.toFixed(2)}` : null,
  ].filter(Boolean);

  return (
    <Modal
      width={860}
      title={t("runDetail.title", { name: evalCase.name })}
      subtitle={subtitleParts.join(" · ")}
      onClose={onClose}
    >
      <div style={s.body}>
        <div style={s.statusStrip(passed)}>
          {run.pass == null ? (
            <Icon.Info size={15} />
          ) : passed ? (
            <Icon.CheckCircle size={15} />
          ) : (
            <Icon.XCircle size={15} />
          )}
          <span>
            {run.pass == null
              ? t("runDetail.noVerdict")
              : passed
                ? t("runDetail.passed")
                : t("runDetail.failed")}
          </span>
        </div>

        <div style={s.scoreGrid}>
          <div style={s.scoreCard}>
            <div style={s.scoreLabel}>{t("dashboard.metrics.recall")}</div>
            <div style={s.scoreValue}>{pct(run.recall)}</div>
            <div style={s.scoreSub}>
              {t("runDetail.matchedOf", {
                matched: count(run.matched),
                total: count(run.expected_total),
              })}
            </div>
          </div>
          <div style={s.scoreCard}>
            <div style={s.scoreLabel}>{t("dashboard.metrics.precision")}</div>
            <div style={s.scoreValue}>{pct(run.precision)}</div>
            <div style={s.scoreSub}>
              {t("runDetail.falsePositives", { count: count(run.false_positives) })}
            </div>
          </div>
          <div style={s.scoreCard}>
            <div style={s.scoreLabel}>{t("dashboard.metrics.citationAccuracy")}</div>
            <div style={s.scoreValue}>{pct(run.citation_accuracy)}</div>
            <div style={s.scoreSub}>
              {t("runDetail.keptDropped", {
                kept: count(run.kept),
                dropped: count(run.dropped),
              })}
            </div>
          </div>
        </div>

        <div style={s.columns}>
          <div>
            <div style={s.columnLabel}>
              {t("runDetail.expectedColumn", { count: expected.length })}
            </div>
            {expected.length === 0 ? (
              <div style={s.emptyList}>{t("runDetail.expectedEmpty")}</div>
            ) : (
              <div style={s.findingList}>
                {expected.map((e, i) => (
                  <FindingRow
                    key={i}
                    finding={{ ...e, end_line: e.end_line ?? e.start_line }}
                    matched={actual.some((p) => matchesExpectation(e, p))}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={s.columnLabel}>
              {t("runDetail.actualColumn", { count: actual.length })}
            </div>
            {actual.length === 0 ? (
              <div style={s.emptyList}>{t("runDetail.actualEmpty")}</div>
            ) : (
              <div style={s.findingList}>
                {actual.map((p) => (
                  <FindingRow
                    key={p.id}
                    finding={p}
                    matched={expected.some((e) => matchesExpectation(e, p))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
