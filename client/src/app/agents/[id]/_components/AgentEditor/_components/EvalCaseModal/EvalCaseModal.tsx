"use client";

/**
 * EvalCaseModal — create / edit an eval case (SPEC-03, T21).
 *
 * Layout: two-column Modal.
 *   Left  — Name (required) + Input tabs (Diff / Files / PR meta)
 *   Right — Expected output JSON editor + last-run result strip
 * Footer — Run on save toggle · Cancel · Run case · Save
 */

import React from "react";
import { useTranslations } from "next-intl";
import {
  Modal,
  Button,
  Toggle,
  FormField,
  TextInput,
  Textarea,
  Tabs,
  Icon,
} from "@devdigest/ui";
import type { Agent, EvalCase, EvalRunResult } from "@devdigest/shared";
import {
  useEvalCases,
  useCreateEvalCase,
  useUpdateEvalCase,
  useRunEvals,
} from "../../../../../../../lib/hooks/evals";
import type { EvalPrefillPayload } from "../../../../../../../lib/eval-prefill";
import { FINDING_SKELETON } from "./constants";
import { useEvalCaseForm } from "./hooks/useEvalCaseForm";
import { s } from "./styles";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EvalCaseModalProps {
  /** The agent that owns this eval case. */
  agent: Agent;
  /** `null` → create new case; string → edit existing case by id. */
  caseId: string | null;
  /** Prefill payload from sessionStorage (AC-1). Null when opening manually. */
  prefill: EvalPrefillPayload | null;
  /** Called when the modal should close (cancel, save, or outside-click). */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Read-only labeled field used in the PR meta tab (AC-11). */
function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <FormField label={label}>
      <div style={s.readOnly}>{String(value)}</div>
    </FormField>
  );
}

/** Files tab — read-only list of paths derived from the diff (AC-10). */
function FilesTab({
  files,
  emptyLabel,
}: {
  files: string[];
  emptyLabel: string;
}) {
  if (files.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
        {emptyLabel}
      </p>
    );
  }
  return (
    <div>
      {files.map((path) => (
        <div key={path} style={s.fileRow}>
          <Icon.FileText size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          {path}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EvalCaseModal({
  agent,
  caseId,
  prefill,
  onClose,
}: EvalCaseModalProps): React.ReactElement {
  const t = useTranslations("eval");

  // Resolve existing case from cache (already fetched by EvalsTab — no extra request).
  const { data: cases } = useEvalCases(agent.id);
  const existingCase: EvalCase | null =
    caseId != null
      ? (cases ?? []).find((c) => c.id === caseId) ?? null
      : null;

  // Form state
  const form = useEvalCaseForm({ existingCase, prefill });

  // Mutations
  const createCase = useCreateEvalCase(agent.id);
  const updateCase = useUpdateEvalCase(agent.id);
  const runEvals = useRunEvals(agent.id);

  // Modal-session run result (shown when runOnSave is used or Run case clicked)
  const [runResult, setRunResult] = React.useState<EvalRunResult | null>(null);

  // Saving in-flight flag (covers both create/update + optional run)
  const [isSaving, setIsSaving] = React.useState(false);

  const isBusy = isSaving || createCase.isPending || updateCase.isPending || runEvals.isPending;

  // ── Save handler ─────────────────────────────────────────────────────────

  /**
   * andRun = true: save then immediately run (used by "Run case" button
   *   and by "Save" when the "Run on save" toggle is enabled — AC-9).
   * andRun = false: save only (regular Save).
   */
  const handleSave = React.useCallback(
    async (andRun: boolean) => {
      if (!form.canSave || isBusy) return;

      setIsSaving(true);
      try {
        const body = {
          owner_kind: "agent" as const,
          owner_id: agent.id,
          name: form.name.trim(),
          input_diff: form.diff,
          expected_output: form.jsonParseResult.ok ? form.jsonParseResult.value : [],
          // T25 fix: forward input_meta so the server's captureEnrichment (T11)
          // can freeze the enrichment block (callers, context docs, intent,
          // rank note) from the originating run. Only included for new cases
          // created from a finding prefill — edits omit this key so the
          // existing frozen meta is preserved unchanged on the server.
          ...(caseId == null && prefill ? { input_meta: prefill.input_meta } : {}),
        };

        let savedCase: EvalCase;
        if (caseId != null) {
          savedCase = await updateCase.mutateAsync({ caseId, body });
        } else {
          savedCase = await createCase.mutateAsync(body);
        }

        const shouldRun = andRun || form.runOnSave;
        if (shouldRun) {
          const results = await runEvals.mutateAsync({ case_ids: [savedCase.id] });
          const myResult =
            results.find((r) => r.case_id === savedCase.id) ?? results[0] ?? null;
          setRunResult(myResult);
          // Modal stays open so the user sees the result.
        } else {
          onClose();
        }
      } catch {
        // Mutation error shown via isPending/isError on the mutation objects.
        // No extra handling needed here; the button re-enables on error.
      } finally {
        setIsSaving(false);
      }
    },
    [
      form,
      isBusy,
      caseId,
      agent.id,
      createCase,
      updateCase,
      runEvals,
      onClose,
    ],
  );

  // ── Input tab definitions ────────────────────────────────────────────────

  const inputTabs = [
    { key: "diff", label: t("caseEditor.tabs.diff") },
    {
      key: "files",
      label: t("caseEditor.tabs.files"),
      count: form.filesInDiff.length > 0 ? form.filesInDiff.length : undefined,
    },
    { key: "prMeta", label: t("caseEditor.tabs.prMeta") },
  ];

  // ── Result strip data ─────────────────────────────────────────────────────

  const resultRun = runResult?.result;
  // The scorer's own verdict for this case (AC-30) — never re-derive it from the
  // metrics. `recall > 0 || precision > 0` is wrong: a case with an EMPTY expected
  // output (the dismissed-finding shape) scores recall = 1 by definition (AC-24),
  // so a run that failed by producing findings it should not have would still read
  // as passed. A single-case run always yields exactly one per_trace entry.
  const resultPassed = resultRun?.per_trace[0]?.pass === true;
  const resultTrace = resultRun?.per_trace[0];
  const expectedCount = Array.isArray(resultTrace?.expected)
    ? resultTrace.expected.length
    : 0;
  const actualCount = Array.isArray(resultTrace?.actual)
    ? resultTrace.actual.length
    : 0;
  const costSuffix =
    resultRun?.cost_usd != null ? ` · $${resultRun.cost_usd.toFixed(2)}` : "";

  // ── Render ─────────────────────────────────────────────────────────────────

  const title = caseId
    ? t("caseEditor.caseTitle", { name: form.name || "…" })
    : t("caseEditor.newCase");

  return (
    <Modal
      width={840}
      title={title}
      subtitle={t("caseEditor.subtitle", { agentName: agent.name })}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <div style={s.footerLeft}>
            <Toggle on={form.runOnSave} onChange={form.setRunOnSave} />
            <span>{t("caseEditor.runOnSave")}</span>
          </div>
          <div style={s.footerRight}>
            <Button kind="ghost" onClick={onClose} disabled={isBusy}>
              {t("caseEditor.cancel")}
            </Button>
            <Button
              kind="secondary"
              icon="Play"
              disabled={!form.canSave || isBusy}
              onClick={() => handleSave(true)}
            >
              {isBusy && (form.runOnSave || isSaving)
                ? t("caseEditor.running")
                : t("caseEditor.runCase")}
            </Button>
            <Button
              kind="primary"
              icon="Check"
              disabled={!form.canSave || isBusy}
              onClick={() => handleSave(false)}
            >
              {isBusy ? t("caseEditor.saving") : t("caseEditor.save")}
            </Button>
          </div>
        </div>
      }
    >
      <div style={s.body}>
        {/* ── Left column ──────────────────────────────────────────────── */}
        <div style={s.leftCol}>
          <div style={s.colPad}>
            {/* Name (AC-8 — Save disabled when empty) */}
            <FormField label={t("caseEditor.nameLabel")} required>
              <TextInput
                value={form.name}
                onChange={form.setName}
                placeholder={t("caseEditor.namePlaceholder")}
              />
            </FormField>

            {/* Input label */}
            <div style={s.sectionLabel}>{t("caseEditor.inputLabel")}</div>
          </div>

          {/* Input tabs strip (flush to column edges, no extra padding) */}
          <Tabs
            tabs={inputTabs}
            value={form.activeInputTab}
            onChange={(k) => form.setActiveInputTab(k as typeof form.activeInputTab)}
            pad="0 24px"
          />

          {/* Tab panel */}
          <div style={s.tabPanel}>
            {form.activeInputTab === "diff" && (
              <Textarea
                value={form.diff}
                onChange={form.setDiff}
                placeholder={t("caseEditor.diffPlaceholder")}
                rows={14}
                mono
              />
            )}

            {form.activeInputTab === "files" && (
              <FilesTab
                files={form.filesInDiff}
                emptyLabel={t("caseEditor.filesEmpty")}
              />
            )}

            {form.activeInputTab === "prMeta" && (
              <>
                {form.prMeta ? (
                  <>
                    <ReadOnlyField
                      label={t("caseEditor.numberLabel")}
                      value={form.prMeta.number}
                    />
                    <ReadOnlyField
                      label={t("caseEditor.titleLabel")}
                      value={form.prMeta.title}
                    />
                    <ReadOnlyField
                      label={t("caseEditor.authorLabel")}
                      value={form.prMeta.author}
                    />
                    <FormField label={t("caseEditor.bodyLabel")}>
                      <div
                        style={{
                          ...s.readOnly,
                          whiteSpace: "pre-wrap",
                          maxHeight: 180,
                          overflow: "auto",
                        }}
                      >
                        {form.prMeta.body || "—"}
                      </div>
                    </FormField>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                    {t("caseEditor.preview")}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Right column — Expected output ────────────────────────────── */}
        <div style={s.rightCol}>
          {/* Expected output header: label + JSON badge + Finding skeleton button */}
          <div style={s.expectedHeader}>
            <span style={s.expectedHeaderLabel}>
              {t("caseEditor.expectedOutput")}
            </span>

            {/* Expected-output validity badge (AC-7).
                A schema failure is NOT a JSON failure: the `Finding skeleton`
                below inserts a deliberately-empty template, and calling that
                "invalid JSON" would send the user looking for a syntax error
                that isn't there. Report which field is incomplete instead. */}
            <span
              style={s.jsonBadge(form.jsonParseResult.ok)}
              title={
                form.jsonParseResult.ok ? undefined : form.jsonParseResult.error
              }
            >
              {form.jsonParseResult.ok ? (
                <Icon.Check size={12} />
              ) : (
                <Icon.X size={12} />
              )}
              {form.jsonParseResult.ok
                ? t("caseEditor.validJson")
                : form.jsonParseResult.kind === "syntax"
                  ? t("caseEditor.invalidJson")
                  : t("caseEditor.incompleteExpected")}
            </span>

            {/* Finding skeleton button (AC-12) */}
            <Button
              kind="ghost"
              size="sm"
              icon="Plus"
              onClick={() => {
                const skeleton = JSON.stringify(FINDING_SKELETON, null, 2);
                // Insert skeleton into the array. Try to parse first; fall back to append.
                try {
                  const arr: unknown[] = JSON.parse(form.expectedOutputText);
                  arr.push(FINDING_SKELETON);
                  form.setExpectedOutputText(JSON.stringify(arr, null, 2));
                } catch {
                  // Invalid JSON — append a skeleton object after the existing text.
                  form.setExpectedOutputText(
                    `${form.expectedOutputText.trimEnd()}\n${skeleton}`,
                  );
                }
              }}
            >
              {t("caseEditor.findingSkeleton")}
            </Button>
          </div>

          <div style={{ padding: "16px 24px", overflow: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Off-diff warning (AC — warn when expected file absent from diff) */}
            {form.offDiffFiles.length > 0 && (
              <div style={s.warnBanner}>
                <Icon.AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  {t("caseEditor.offDiffWarn", {
                    count: form.offDiffFiles.length,
                  })}
                  {": "}
                  {form.offDiffFiles.join(", ")}
                </span>
              </div>
            )}

            {/* JSON editor — the only editable field in the right column */}
            <Textarea
              value={form.expectedOutputText}
              onChange={form.setExpectedOutputText}
              rows={12}
              mono
            />

            {/* The specific reason Save is disabled. Lives here rather than in
                the header pill so the full Zod message (e.g. "0.title: String
                must contain at least 1 character(s)") has room to render — the
                pill only has space for the one-word verdict. */}
            {!form.jsonParseResult.ok && (
              <span style={s.expectedError}>{form.jsonParseResult.error}</span>
            )}
          </div>

          {/* Last-run result strip (shown after run-on-save or Run case, AC-9) */}
          {runResult && resultRun && (
            <div style={s.resultStrip(resultPassed)}>
              {resultPassed ? (
                <Icon.CheckCircle size={15} />
              ) : (
                <Icon.XCircle size={15} />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span>
                  {resultPassed
                    ? t("caseEditor.lastRunPassed")
                    : t("caseEditor.lastRunFailed")}
                  {" · "}
                  {t("caseEditor.resultCounts", {
                    expected: expectedCount,
                    actual: actualCount,
                    duration: (resultRun.duration_ms / 1000).toFixed(1),
                    costSuffix,
                  })}
                </span>
                <span style={{ opacity: 0.75, fontSize: 12 }}>
                  {t("caseEditor.resultSummary", {
                    recall: Math.round(resultRun.recall * 100),
                    precision: Math.round(resultRun.precision * 100),
                    citation: Math.round(resultRun.citation_accuracy * 100),
                  })}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
