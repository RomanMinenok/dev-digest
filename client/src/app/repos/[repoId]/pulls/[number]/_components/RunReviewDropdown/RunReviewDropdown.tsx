/* RunReviewDropdown — ported from components2.jsx, now renders the
   AgentRunPicker (T-22) instead of a flat item list. The trigger button is
   unchanged; opening it reveals a checkbox-based agent picker that posts
   POST /pulls/:id/review with the selected agentIds and hands the resulting
   runIds up so the parent's SSE subscription keeps working untouched. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@devdigest/ui";
import { AgentRunPicker } from "@/components/agentRunPicker";
import { useRunReview } from "../../../../../../../lib/hooks/reviews";
import { DROPDOWN_WIDTH } from "./constants";
import { s } from "./styles";

export function RunReviewDropdown({
  prId,
  size = "sm",
  kind = "primary",
  warnMerged = false,
  onRunStart,
  onRunsStarted,
  onRunSettled,
}: {
  prId: string;
  size?: "sm" | "md" | "lg";
  kind?: "primary" | "secondary";
  /** PR is already merged/closed — dim the trigger and warn, but still allow. */
  warnMerged?: boolean;
  /** Fired the moment a run is kicked off (before it completes). */
  onRunStart?: () => void;
  onRunsStarted?: (runIds: string[]) => void;
  /** Fired when the run request settles (success or error). */
  onRunSettled?: () => void;
}) {
  const t = useTranslations("prReview");
  const run = useRunReview();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const runAgents = async (agentIds: string[]) => {
    onRunStart?.();
    try {
      const res = await run.mutateAsync({ prId, agentIds });
      onRunsStarted?.(res.runs.map((r) => r.run_id));
      setOpen(false);
    } finally {
      onRunSettled?.();
    }
  };

  return (
    <div ref={ref} style={s.root}>
      <div onClick={() => setOpen((o) => !o)}>
        <span
          title={warnMerged ? t("runReview.mergedTooltip") : undefined}
          style={warnMerged ? { opacity: 0.6 } : undefined}
        >
          <Button kind={kind} size={size} iconRight="ChevronDown" icon="Sparkles" loading={run.isPending}>
            {run.isPending ? t("runReview.running") : t("runReview.runReview")}
          </Button>
        </span>
      </div>
      {open && (
        <div style={{ ...s.panel, width: DROPDOWN_WIDTH }}>
          {warnMerged && <div style={s.mergedWarning}>{t("runReview.mergedWarning")}</div>}
          <AgentRunPicker onRun={runAgents} isRunning={run.isPending} />
        </div>
      )}
    </div>
  );
}
