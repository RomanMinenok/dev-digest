/* FindingsPanel — hide-low-confidence + j/k navigation + FindingCard list,
   wiring the accept/dismiss action hook (A2). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Toggle, EmptyState } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { useFindingAction } from "../../../../../../../lib/hooks/reviews";
import { useAgents } from "../../../../../../../lib/hooks/agents";
import { usePullDetail } from "../../../../../../../lib/hooks/core";
import { writeEvalPrefill } from "../../../../../../../lib/eval-prefill";
import {
  slugifyTitle,
  sliceDiffToFile,
  expectedFromFinding,
} from "../../../../../../../lib/eval-capture";
import { KEY_TO_ACTION } from "./constants";
import { visibleFindings } from "./helpers";
import { s } from "./styles";

export function FindingsPanel({
  findings,
  prId,
  repoFullName,
  headSha,
  agentId,
  runId,
  activeSeverity = null,
  targetFindingId = null,
  onScrolledToTarget,
}: {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
  /** The agent that produced this run's findings. Null when the review has no
   *  agent (e.g. a summary-only review). Used for fail-closed eval-case creation. */
  agentId?: string | null;
  /** The run id from the parent ReviewRecord — needed for the eval-case source
   *  provenance block. Null when the review has no run (e.g. legacy rows). */
  runId?: string | null;
  activeSeverity?: string | null;
  /** Finding to focus/expand/scroll to on mount (e.g. from a Smart Diff badge click). */
  targetFindingId?: string | null;
  /** Called once the target finding has been scrolled to (or confirmed absent from
   *  this panel) — the caller uses this to clear `targetFindingId` so a later
   *  plain tab revisit doesn't replay the scroll animation. */
  onScrolledToTarget?: () => void;
}) {
  const t = useTranslations("prReview");
  const router = useRouter();
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  const [focusIdx, setFocusIdx] = React.useState(0);

  // Fail-closed: verify the agent still exists in the workspace before enabling
  // the "Turn into eval case" button. useAgents() is already cached globally.
  const { data: agents } = useAgents();
  const agentExists =
    agentId != null &&
    agents != null &&
    agents.some((a) => a.id === agentId);

  // Cached PR detail — already fetched by the page; no new network request.
  const { data: prDetail } = usePullDetail(prId);

  const shown = React.useMemo(
    () => visibleFindings(findings, hideLow, activeSeverity),
    [findings, hideLow, activeSeverity],
  );

  React.useEffect(() => {
    if (!targetFindingId) return;
    const idx = shown.findIndex((f) => f.id === targetFindingId);
    if (idx < 0) return; // finding isn't in this panel (or filtered out) — not our target to own
    setFocusIdx(idx);
    // The owning ReviewRunAccordion may still be mid-expand (it opens in the
    // same commit that mounts us) — wait a frame so the card's real layout
    // position is settled before centering on it, otherwise it lands at a
    // pre-expand offset that can end up off-screen.
    const raf = requestAnimationFrame(() => {
      document
        .querySelector(`[data-finding-id="${targetFindingId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      // Consume the target so a later plain revisit to this tab (targetFindingId
      // still truthy but nothing new to scroll to) doesn't replay the animation.
      onScrolledToTarget?.();
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetFindingId]);

  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, shown.length - 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else if (KEY_TO_ACTION[e.key] && shown[focusIdx]) {
        action.mutate({ findingId: shown[focusIdx]!.id, action: KEY_TO_ACTION[e.key]!, prId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shown, focusIdx, action, prId]);

  /** Build the "Turn into eval case" handler for one finding. Returns undefined
   *  when the agent no longer exists in the workspace (fail-closed). */
  function buildEvalCaseHandler(f: FindingRecord): (() => void) | undefined {
    if (!agentExists || !agentId || !runId) return undefined;
    return () => {
      const files = prDetail?.files ?? [];
      const pr = prDetail
        ? {
            number: prDetail.number,
            title: prDetail.title,
            body: prDetail.body ?? "",
            author: prDetail.author,
          }
        : { number: 0, title: "", body: "", author: "" };

      writeEvalPrefill({
        agentId,
        name: slugifyTitle(f.title),
        input_diff: sliceDiffToFile(files, f.file),
        input_files: null,
        input_meta: {
          pr,
          source: {
            finding_id: f.id,
            review_id: f.review_id,
            run_id: runId,
            pr_id: prId,
          },
        },
        expected_output: expectedFromFinding(f),
      });
      router.push(`/agents/${agentId}?tab=evals&prefill=1`);
    };
  }

  return (
    <div>
      <div style={s.toolbar}>
        <div style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle on={hideLow} onChange={setHideLow} size={16} />
        </div>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              key={f.id}
              f={f}
              focused={i === focusIdx || f.id === targetFindingId}
              defaultExpanded={i === 0 || f.id === targetFindingId}
              pending={action.isPending}
              repoFullName={repoFullName}
              headSha={headSha}
              agentId={agentId}
              onTurnIntoEvalCase={buildEvalCaseHandler(f)}
              onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
