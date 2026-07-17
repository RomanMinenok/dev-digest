/* CiTabView — presenter for the Agent Editor CI tab (SPEC-05, T29).
   Receives data + callbacks from CiTab; no data-fetching hooks. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, FormField, Icon, SelectInput } from "@devdigest/ui";
import type { Agent, CiFailOn, CiTarget } from "@devdigest/shared";
import type { CiInstallationWithStatus } from "../../../../../../../lib/hooks/ci";
import { CI_FAIL_ON_VALUES } from "../ConfigTab/constants";
import { TARGET_I18N, statusVisual } from "./constants";
import { formatRelativeAgo, githubRepoUrl, targetUsesGitHubIcon } from "./helpers";
import { s } from "./styles";

export interface CiTabViewProps {
  agent: Agent;
  installations: CiInstallationWithStatus[];
  loading: boolean;
  updatingInstallationId: string | null;
  updatingAll: boolean;
  failOnPending: boolean;
  onFailOnChange: (value: CiFailOn) => void;
  onUpdateConfig: () => void;
  onOpenWizard: () => void;
}

function InstallationRow({
  installation,
  updating,
}: {
  installation: CiInstallationWithStatus;
  updating: boolean;
}) {
  const t = useTranslations("ci");
  const visual = statusVisual(installation.status);
  const statusLabel =
    visual.i18nKey != null ? t(`runs.status.${visual.i18nKey}`) : (installation.status ?? "—");
  const targetKey = TARGET_I18N[installation.target_type as CiTarget];
  const targetLabel = t(targetKey);
  const relativeAt = formatRelativeAgo(installation.last_run_at ?? installation.installed_at);

  return (
    <div style={s.row} data-updating={updating || undefined}>
      <div style={s.repoCell}>
        <a
          href={githubRepoUrl(installation.repo)}
          target="_blank"
          rel="noopener noreferrer"
          style={s.repoLink}
          title={installation.repo}
        >
          <Icon.Link size={14} color="var(--text-muted)" />
          <span style={s.repoName}>{installation.repo}</span>
        </a>
      </div>

      <div style={s.targetCell} title={targetLabel}>
        {targetUsesGitHubIcon(installation.target_type as CiTarget) ? (
          <Icon.GitBranch size={12} color="var(--text-muted)" />
        ) : (
          <Icon.Workflow size={12} color="var(--text-muted)" />
        )}
        <span style={s.targetLabel}>{targetLabel}</span>
      </div>

      <div style={s.statusCell}>
        <Badge dot color={visual.color} bg={visual.bg}>
          {statusLabel}
        </Badge>
      </div>

      <span style={s.timeCell}>{relativeAt}</span>
    </div>
  );
}

export function CiTabView({
  agent,
  installations,
  loading,
  updatingInstallationId,
  updatingAll,
  failOnPending,
  onFailOnChange,
  onUpdateConfig,
  onOpenWizard,
}: CiTabViewProps) {
  const tAgents = useTranslations("agents");
  const t = useTranslations("ci");
  const count = installations.length;
  const hasInstallations = count > 0;

  const failOnOptions = CI_FAIL_ON_VALUES.map((v) => ({
    value: v,
    label: tAgents(`config.ciFailOnOptions.${v}`),
  }));

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.titleRow}>
            <h2 style={s.h2}>{t("ciTab.deploymentTitle")}</h2>
            {hasInstallations ? (
              <span style={s.activeBadge}>{t("ciTab.activeInRepos", { count })}</span>
            ) : null}
          </div>
        </div>
        <div style={s.headerActions}>
          <Button
            kind="secondary"
            size="sm"
            icon="RefreshCw"
            disabled={!hasInstallations || updatingAll}
            loading={updatingAll}
            onClick={onUpdateConfig}
          >
            {updatingAll ? t("ciTab.updatingConfig") : t("ciTab.updateConfig")}
          </Button>
          <Button kind="primary" size="sm" icon="Plus" onClick={onOpenWizard}>
            {t("ciTab.addToCi")}
          </Button>
        </div>
      </div>

      <div style={s.failOnSection}>
        <FormField label={t("ciTab.failCiOn")} hint={tAgents("config.ciFailOnHint")}>
          <SelectInput
            value={agent.ci_fail_on}
            onChange={(v) => {
              if (!failOnPending) onFailOnChange(v as CiFailOn);
            }}
            options={failOnOptions}
          />
        </FormField>
      </div>

      {loading ? (
        <div style={s.loading}>{t("ciTab.loading")}</div>
      ) : !hasInstallations ? (
        <div style={s.empty}>{t("ciTab.empty")}</div>
      ) : (
        <div style={s.list}>
          {installations.map((installation) => (
            <InstallationRow
              key={installation.id}
              installation={installation}
              updating={updatingInstallationId === installation.id}
            />
          ))}
        </div>
      )}

      <button type="button" style={s.addRow} onClick={onOpenWizard}>
        <Icon.Plus size={14} />
        {t("ciTab.addRepository")}
      </button>
    </div>
  );
}
