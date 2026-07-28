/* ResultsTabs — the Tabs results view for a multi-agent run (SPEC-05, T-26 —
   AC-21, AC-22, AC-23, AC-27). One tab per member agent with a score badge;
   the active tab renders an agent summary card ("View trace" + duration/cost)
   and its findings, each expandable to confidence + suggested fix. An
   expanded finding renders exactly three actions — Accept, Dismiss, "Turn
   into eval case" — never `Learn` or "Reply to author" (AC-22), in any
   state. Accept/Dismiss reuse the existing `useFindingAction` mutation;
   "Turn into eval case" reuses the existing capture path (AC-23):
   `writeEvalPrefill` + a push to `/agents/:agentId?tab=evals&prefill=1`,
   fail-closed when the owning agent no longer exists in the workspace — see
   `FindingsPanel.tsx:113-144` for the precedent this mirrors.

   T-27's "Findings by location" matrix (`_components/FindingsByLocation/`)
   is NOT mounted here: this component is only ever reached through
   `ResultsColumns`'s mode switch, which mounts the matrix once below the
   mode-conditional block so both Columns and Tabs share the same instance
   instead of remounting it per mode. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs } from "@devdigest/ui";
import type { FindingRecord, MultiAgentMember, MultiAgentRunView } from "@devdigest/shared";
import { useAgents } from "@/lib/hooks/agents";
import { usePullDetail } from "@/lib/hooks/core";
import { useFindingAction } from "@/lib/hooks/reviews";
import { writeEvalPrefill } from "@/lib/eval-prefill";
import { slugifyTitle, sliceDiffToFile, expectedFromFinding } from "@/lib/eval-capture";
import { buildTabs, tabState, type TabState } from "./helpers";
import { AgentSummaryCard } from "./AgentSummaryCard";
import { FindingItem } from "./FindingItem";
import { s } from "./styles";

export interface ResultsTabsProps {
  run: MultiAgentRunView;
  onViewTrace: (member: MultiAgentMember, state: TabState) => void;
}

export function ResultsTabs({ run, onViewTrace }: ResultsTabsProps) {
  const router = useRouter();
  const t = useTranslations("multiAgent");
  const action = useFindingAction();

  // Fail-closed: verify the owning agent still exists in the workspace
  // before enabling "Turn into eval case" (mirrors FindingsPanel.tsx:59-65).
  const { data: agents } = useAgents();
  // Cached PR detail — same query key as the PR page, so this is a shared
  // cache read rather than a duplicate network request when both are open.
  const { data: prDetail } = usePullDetail(run.pr_id);

  const [activeRunId, setActiveRunId] = React.useState<string | undefined>(run.members[0]?.run_id);
  const member = run.members.find((m) => m.run_id === activeRunId) ?? run.members[0];

  if (!member) return null;

  const state = tabState(member);
  const tabs = buildTabs(run.members, t("results.removedAgent"));

  function buildEvalCaseHandler(finding: FindingRecord): (() => void) | undefined {
    const agentId = member!.agent_id;
    const agentExists = agentId != null && agents != null && agents.some((a) => a.id === agentId);
    if (!agentExists || !agentId) return undefined;
    return () => {
      const files = prDetail?.files ?? [];
      const pr = prDetail
        ? { number: prDetail.number, title: prDetail.title, body: prDetail.body ?? "", author: prDetail.author }
        : { number: 0, title: "", body: "", author: "" };

      writeEvalPrefill({
        agentId,
        name: slugifyTitle(finding.title),
        input_diff: sliceDiffToFile(files, finding.file),
        input_files: null,
        input_meta: {
          pr,
          source: {
            finding_id: finding.id,
            review_id: finding.review_id,
            run_id: member!.run_id,
            pr_id: run.pr_id,
          },
        },
        expected_output: expectedFromFinding(finding),
      });
      router.push(`/agents/${agentId}?tab=evals&prefill=1`);
    };
  }

  return (
    <div style={s.root}>
      <Tabs tabs={tabs} value={member.run_id} onChange={setActiveRunId} pad="0" />

      <AgentSummaryCard member={member} state={state} onViewTrace={() => onViewTrace(member, state)} />

      <div style={s.findings}>
        {state === "failed" ? (
          <div style={s.errorBox}>{member.error ?? t("results.runFailed")}</div>
        ) : member.findings.length === 0 ? (
          <div style={s.emptyNote}>{state === "running" ? t("results.running") : t("results.noFindings")}</div>
        ) : (
          member.findings.map((finding, i) => (
            <FindingItem
              key={finding.id}
              finding={finding}
              defaultExpanded={i === 0}
              pending={action.isPending}
              onAction={(act) => action.mutate({ findingId: finding.id, action: act, prId: run.pr_id })}
              onTurnIntoEvalCase={buildEvalCaseHandler(finding)}
            />
          ))
        )}
      </div>
    </div>
  );
}
