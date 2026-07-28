/* CiTab — container for the Agent Editor CI tab (SPEC-05, T29).
   Owns data-fetching, export/update mutations, and ExportWizard open state (T30). */
"use client";

import React from "react";
import type { Agent, CiFailOn } from "@devdigest/shared";
import {
  useCiExport,
  useCiFailOn,
  useCiInstallations,
} from "../../../../../../../lib/hooks/ci";
import { CiTabView } from "./CiTabView";
import { ExportWizard } from "./ExportWizard";

export function CiTab({ agent }: { agent: Agent }) {
  const { data: installations, isLoading } = useCiInstallations(agent.id);
  const ciExport = useCiExport();
  const ciFailOn = useCiFailOn();

  const [wizardOpen, setWizardOpen] = React.useState(false);
  const openWizard = React.useCallback(() => setWizardOpen(true), []);
  const closeWizard = React.useCallback(() => setWizardOpen(false), []);

  const rows = installations ?? [];

  /**
   * Re-export every installation (AC-23 update path). One shared mutation —
   * derive scope-specific pending from `variables`, not bare `isPending`.
   */
  const updatingInstallationId =
    ciExport.isPending && ciExport.variables?.body.repo
      ? (rows.find((row) => row.repo === ciExport.variables?.body.repo)?.id ?? null)
      : null;

  const updatingAll = ciExport.isPending;

  const handleUpdateConfig = React.useCallback(async () => {
    if (rows.length === 0 || ciExport.isPending) return;
    for (const installation of rows) {
      try {
        await ciExport.mutateAsync({
          agentId: agent.id,
          body: {
            repo: installation.repo,
            target: installation.target_type,
            action: "open_pr",
          },
        });
      } catch {
        break;
      }
    }
  }, [agent.id, ciExport, rows]);

  const handleFailOnChange = React.useCallback(
    (ci_fail_on: CiFailOn) => {
      if (ci_fail_on === agent.ci_fail_on || ciFailOn.isPending) return;
      ciFailOn.mutate({ agentId: agent.id, ci_fail_on });
    },
    [agent.ci_fail_on, agent.id, ciFailOn],
  );

  return (
    <>
      <CiTabView
        agent={agent}
        installations={rows}
        loading={isLoading}
        updatingInstallationId={updatingInstallationId}
        updatingAll={updatingAll}
        failOnPending={ciFailOn.isPending}
        onFailOnChange={handleFailOnChange}
        onUpdateConfig={() => {
          void handleUpdateConfig();
        }}
        onOpenWizard={openWizard}
      />
      {wizardOpen ? <ExportWizard agent={agent} onClose={closeWizard} /> : null}
    </>
  );
}
