/* CompareRunsModal — compares two selected version runs (mock 02, AC-24…29).

   The two runs' metrics and cost are already loaded from the dashboard response
   — the modal does NOT refetch them (AC-24). It fetches only the two version
   snapshots (`useAgentVersion`) to build the line-level system-prompt diff
   (AC-25), rendered as PLAIN TEXT in a <pre> — never through the shared Markdown
   component and never via dangerouslySetInnerHTML (AC-28; a system prompt is
   arbitrary text with code fences and angle brackets — data, not markup).

   Degraded states:
   - identical prompts → "no prompt changes" (AC-26)
   - a 404 / error on either snapshot → still render the four delta cards, and
     replace ONLY the diff pane with "prompt unavailable" (AC-27)

   Footer is Close only — there is no Promote button and no promote/restore call
   anywhere (AC-29). */
"use client";

import { useTranslations } from "next-intl";
import { Button, Icon, Modal } from "@devdigest/ui";
import type { EvalVersionRun } from "@devdigest/shared";
import { useAgentVersion } from "@/lib/hooks/eval-dashboard";
import { COMPARE_CARDS, type CompareCardField } from "./constants";
import { diffPromptLines, promptsAreIdentical } from "./helpers";
import { deltaColor, diffLineStyle, diffSign, s } from "./styles";

export interface CompareRunsModalProps {
  agentId: string;
  /** The two selected version runs (unordered — the modal sorts by version). */
  pair: [EvalVersionRun, EvalVersionRun];
  onClose: () => void;
}

function formatMetric(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatCost(value: number | null): string {
  // "—" (never "$0.00") when no case in the run reported a cost.
  return value == null ? "—" : `$${value.toFixed(2)}`;
}

/** Metric delta in whole percentage points; cost delta in dollars. `null` when
    a cost delta is undefined because one side has no cost. */
function computeDelta(field: CompareCardField, oldRun: EvalVersionRun, newRun: EvalVersionRun): number | null {
  if (field === "cost_usd") {
    if (oldRun.cost_usd == null || newRun.cost_usd == null) return null;
    return newRun.cost_usd - oldRun.cost_usd;
  }
  return Math.round(newRun[field] * 100) - Math.round(oldRun[field] * 100);
}

function formatDelta(field: CompareCardField, delta: number): string {
  const sign = delta > 0 ? "+" : "";
  if (field === "cost_usd") return `${sign}$${delta.toFixed(2)}`;
  return `${sign}${delta}pp`;
}

export function CompareRunsModal({ agentId, pair, onClose }: CompareRunsModalProps) {
  const t = useTranslations("eval");

  // Lower version = "old", higher = "new". The run list is unique by version, so
  // the two are always different versions (AC-23).
  const [older, newer] =
    pair[0].agent_version <= pair[1].agent_version ? [pair[0], pair[1]] : [pair[1], pair[0]];

  const oldVersion = useAgentVersion(agentId, older.agent_version);
  const newVersion = useAgentVersion(agentId, newer.agent_version);

  const promptUnavailable = oldVersion.isError || newVersion.isError;
  const promptsLoading = oldVersion.isLoading || newVersion.isLoading;
  const oldPrompt = oldVersion.data?.config.system_prompt ?? null;
  const newPrompt = newVersion.data?.config.system_prompt ?? null;
  const bothLoaded = oldPrompt !== null && newPrompt !== null;

  const renderValue = (field: CompareCardField, run: EvalVersionRun): string =>
    field === "cost_usd" ? formatCost(run.cost_usd) : formatMetric(run[field]);

  return (
    <Modal
      width={760}
      title={t("compareModal.title", { from: `v${older.agent_version}`, to: `v${newer.agent_version}` })}
      subtitle={t("compareModal.subtitle", { traces: newer.cases_total })}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="secondary" onClick={onClose}>
            {t("compareModal.close")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        {/* Four old→new delta cards (AC-24). */}
        <div style={s.cardsRow}>
          {COMPARE_CARDS.map(({ field, labelKey, goodDirection }) => {
            const delta = computeDelta(field, older, newer);
            const DeltaIcon =
              delta == null || delta === 0 ? Icon.Slash : delta > 0 ? Icon.ArrowUp : Icon.ArrowDown;
            return (
              <div key={field} style={s.card}>
                <span style={s.cardLabel}>{t(`dashboard.metrics.${labelKey}`)}</span>
                <span style={s.cardValues}>
                  <span style={s.cardOld}>{renderValue(field, older)}</span>
                  <span style={s.cardArrow}>→</span>
                  <span>{renderValue(field, newer)}</span>
                </span>
                {delta != null && (
                  <span style={{ ...s.deltaChip, color: deltaColor(delta, goodDirection) }}>
                    <DeltaIcon size={12} />
                    {formatDelta(field, delta)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Line-level system-prompt diff (AC-25), plain text only. */}
        <div style={s.diffSection}>
          <span style={s.diffHeading}>{t("compareModal.systemPromptDiff")}</span>
          {promptUnavailable ? (
            <div style={s.diffNote}>{t("compareModal.promptUnavailable")}</div>
          ) : promptsLoading || !bothLoaded ? (
            <div style={s.diffNote}>{t("dashboard.loading")}</div>
          ) : promptsAreIdentical(oldPrompt, newPrompt) ? (
            <div style={s.diffNote}>{t("compareModal.noPromptChanges")}</div>
          ) : (
            <pre style={s.diffPane}>
              {diffPromptLines(oldPrompt, newPrompt).map((line, i) => (
                <div key={i} style={diffLineStyle(line.kind)}>
                  <span style={diffSign}>{line.kind === "add" ? "+" : line.kind === "del" ? "−" : " "}</span>
                  <span>{line.text}</span>
                </div>
              ))}
            </pre>
          )}
        </div>
      </div>
    </Modal>
  );
}
