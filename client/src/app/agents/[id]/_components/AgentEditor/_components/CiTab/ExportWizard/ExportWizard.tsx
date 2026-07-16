"use client";

/* ExportWizard — four-step Export to CI modal (SPEC-05, T30).
   Container owns wizard state + active repo; steps are presenters. */

import React from "react";
import { useTranslations } from "next-intl";
import { Button, ExportWizardSteps, Modal } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useActiveRepo } from "../../../../../../../../lib/repo-context";
import { useCiExport, useCiPreview } from "../../../../../../../../lib/hooks/ci";
import { ConfigureStep } from "./_components/ConfigureStep";
import type { PostAsId } from "./_components/ConfigureStep/constants";
import {
  GENERATED_FILE_COUNT_FALLBACK,
  InstallStep,
  buildExportInput,
  downloadZipBlob,
  formatExportError,
  zipFilenameForRepo,
  type InstallMethod,
} from "./_components/InstallStep";
import { PreviewStep } from "./_components/PreviewStep";
import { buildPreviewInput } from "./_components/PreviewStep/helpers";
import { TargetStep } from "./_components/TargetStep";
import { EXPORT_WIZARD_WIDTH, WIZARD_STEP_COUNT } from "./constants";
import { useExportWizard } from "./hooks/useExportWizard";
import { s } from "./styles";

export interface ExportWizardProps {
  agent: Agent;
  onClose: () => void;
}

type PendingConfigureChange =
  | { kind: "triggers"; value: string[] }
  | { kind: "postAs"; value: PostAsId };

function sameTriggerSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

export function ExportWizard({ agent, onClose }: ExportWizardProps) {
  const t = useTranslations("ci");
  const { activeRepo } = useActiveRepo();
  const {
    state,
    reset,
    next,
    back,
    setTarget,
    setWorkflowOverride,
    setTriggers,
    setPostAs,
  } = useExportWizard();
  const {
    mutate: previewMutate,
    data: previewData,
    isPending: previewPending,
    error: previewMutationError,
    reset: resetPreview,
  } = useCiPreview();
  const ciExport = useCiExport();

  const [pendingConfigureChange, setPendingConfigureChange] =
    React.useState<PendingConfigureChange | null>(null);
  const [installMethod, setInstallMethod] = React.useState<InstallMethod>("open_pr");
  const [successPrUrl, setSuccessPrUrl] = React.useState<string | null>(null);
  const [zipDownloaded, setZipDownloaded] = React.useState(false);
  /** Dedupes auto-fetch so unstable mutation identity cannot re-fire the same body. */
  const lastPreviewKeyRef = React.useRef<string | null>(null);

  const repoFullName = activeRepo?.full_name ?? null;
  const hasRepo = repoFullName != null;

  const previewInput = React.useMemo(
    () => (repoFullName ? buildPreviewInput(state, repoFullName) : null),
    [repoFullName, state.base, state.postAs, state.target, state.triggers],
  );

  const previewKey = previewInput ? JSON.stringify(previewInput) : null;

  const fetchPreview = React.useCallback(
    (force = false) => {
      if (!previewInput || !previewKey) return;
      if (!force && lastPreviewKeyRef.current === previewKey) return;
      lastPreviewKeyRef.current = previewKey;
      previewMutate({ agentId: agent.id, body: previewInput });
    },
    [agent.id, previewInput, previewKey, previewMutate],
  );

  React.useEffect(() => {
    if (state.step === 1 && previewInput) {
      fetchPreview();
    }
  }, [state.step, previewInput, fetchPreview]);

  const handleClose = React.useCallback(() => {
    reset();
    lastPreviewKeyRef.current = null;
    setPendingConfigureChange(null);
    setInstallMethod("open_pr");
    setSuccessPrUrl(null);
    setZipDownloaded(false);
    resetPreview();
    ciExport.reset();
    onClose();
  }, [ciExport, onClose, reset, resetPreview]);

  const applyConfigureChange = React.useCallback(
    (change: PendingConfigureChange, clearOverride: boolean) => {
      if (change.kind === "triggers") {
        setTriggers(change.value);
      } else {
        setPostAs(change.value);
      }
      if (clearOverride) {
        setWorkflowOverride(null);
      }
    },
    [setPostAs, setTriggers, setWorkflowOverride],
  );

  const requestConfigureChange = React.useCallback(
    (change: PendingConfigureChange) => {
      const differs =
        change.kind === "triggers"
          ? !sameTriggerSet(change.value, state.triggers)
          : change.value !== state.postAs;

      if (!differs) return;

      if (state.workflowOverride != null) {
        setPendingConfigureChange(change);
        return;
      }

      applyConfigureChange(change, false);
    },
    [applyConfigureChange, state.postAs, state.triggers, state.workflowOverride],
  );

  const confirmRegenerate = React.useCallback(() => {
    if (!pendingConfigureChange) return;
    applyConfigureChange(pendingConfigureChange, true);
    setPendingConfigureChange(null);
    if (previewInput) {
      const body = {
        ...previewInput,
        ...(pendingConfigureChange.kind === "triggers"
          ? { triggers: pendingConfigureChange.value }
          : { post_as: pendingConfigureChange.value }),
      };
      lastPreviewKeyRef.current = JSON.stringify(body);
      previewMutate({ agentId: agent.id, body });
    }
  }, [
    agent.id,
    applyConfigureChange,
    pendingConfigureChange,
    previewInput,
    previewMutate,
  ]);

  const cancelRegenerate = React.useCallback(() => {
    setPendingConfigureChange(null);
  }, []);

  const handleWorkflowChange = React.useCallback(
    (contents: string) => {
      setWorkflowOverride(contents);
    },
    [setWorkflowOverride],
  );

  const stepLabels = React.useMemo(
    () => [
      t("exportWizard.steps.target"),
      t("exportWizard.steps.preview"),
      t("exportWizard.steps.configure"),
      t("exportWizard.steps.install"),
    ],
    [t],
  );

  const previewError =
    previewMutationError instanceof Error
      ? previewMutationError.message
      : previewMutationError
        ? String(previewMutationError)
        : null;

  const isFirst = state.step === 0;
  const isLast = state.step === WIZARD_STEP_COUNT - 1;
  const canContinue = hasRepo && (state.step !== 0 || state.target === "gha");

  const fileCount = previewData?.files.length ?? GENERATED_FILE_COUNT_FALLBACK;

  const pendingExportAction =
    ciExport.isPending && ciExport.variables?.body.action
      ? ciExport.variables.body.action
      : null;

  const exportError = formatExportError(ciExport.error);

  const handleInstallMethodChange = React.useCallback((method: InstallMethod) => {
    setInstallMethod(method);
    setSuccessPrUrl(null);
    setZipDownloaded(false);
    ciExport.reset();
  }, [ciExport]);

  const handleInstall = React.useCallback(async () => {
    if (!repoFullName || ciExport.isPending) return;

    setSuccessPrUrl(null);
    setZipDownloaded(false);

    const body = buildExportInput(state, repoFullName, installMethod);
    try {
      const result = await ciExport.mutateAsync({ agentId: agent.id, body });
      if (result.kind === "json") {
        setSuccessPrUrl(result.data.pr_url);
      } else {
        downloadZipBlob(result.blob, zipFilenameForRepo(repoFullName));
        setZipDownloaded(true);
      }
    } catch {
      /* error surfaced via ciExport.error → InstallStep */
    }
  }, [agent.id, ciExport, installMethod, repoFullName, state]);

  const footer = (
    <div style={isFirst ? s.footer : s.footerSplit}>
      {!isFirst ? (
        <Button kind="ghost" onClick={back}>
          {t("exportWizard.back")}
        </Button>
      ) : null}
      <div style={isFirst ? undefined : s.footerRight}>
        {isLast ? (
          <Button
            kind="primary"
            icon="Check"
            disabled={!hasRepo || ciExport.isPending}
            loading={pendingExportAction === installMethod}
            onClick={() => {
              void handleInstall();
            }}
          >
            {ciExport.isPending ? t("exportWizard.installing") : t("exportWizard.install")}
          </Button>
        ) : (
          <Button kind="primary" icon="ArrowRight" disabled={!canContinue} onClick={next}>
            {t("exportWizard.continue")}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Modal
        width={EXPORT_WIZARD_WIDTH}
        title={t("exportWizard.title")}
        subtitle={t("exportWizard.subtitle", { agentName: agent.name })}
        onClose={handleClose}
        footer={footer}
      >
        <div style={s.body}>
          <div style={s.steps}>
            <ExportWizardSteps step={state.step} labels={stepLabels} />
          </div>

          {!hasRepo ? <div style={s.noRepo}>{t("ciTab.noRepo")}</div> : null}

          {state.step === 0 ? (
            <TargetStep target={state.target} onSelectTarget={setTarget} />
          ) : null}
          {state.step === 1 && hasRepo ? (
            <PreviewStep
              preview={previewData ?? null}
              loading={previewPending}
              error={previewError}
              workflowOverride={state.workflowOverride}
              onWorkflowChange={handleWorkflowChange}
              onRetry={() => fetchPreview(true)}
            />
          ) : null}
          {state.step === 2 ? (
            <ConfigureStep
              triggers={state.triggers}
              postAs={state.postAs}
              onTriggersChange={(value) => requestConfigureChange({ kind: "triggers", value })}
              onPostAsChange={(value) => requestConfigureChange({ kind: "postAs", value })}
            />
          ) : null}
          {state.step === 3 && hasRepo && repoFullName ? (
            <InstallStep
              repoFullName={repoFullName}
              fileCount={fileCount}
              method={installMethod}
              onMethodChange={handleInstallMethodChange}
              pendingAction={pendingExportAction}
              error={exportError}
              successPrUrl={successPrUrl}
              zipDownloaded={zipDownloaded}
            />
          ) : null}
        </div>
      </Modal>

      {pendingConfigureChange ? (
        <Modal
          width={480}
          title={t("exportWizard.regenerateConfirmTitle")}
          subtitle={t("exportWizard.regenerateConfirmBody")}
          onClose={cancelRegenerate}
          footer={
            <div style={s.footerSplit}>
              <Button kind="ghost" onClick={cancelRegenerate}>
                {t("exportWizard.regenerateCancel")}
              </Button>
              <Button kind="primary" onClick={confirmRegenerate}>
                {t("exportWizard.regenerateConfirm")}
              </Button>
            </div>
          }
        />
      ) : null}
    </>
  );
}
