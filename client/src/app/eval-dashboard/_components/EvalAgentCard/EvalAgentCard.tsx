/* EvalAgentCard — one row-card per agent on the Eval Dashboard (mock 01):
   name, monospace model chip, "Last run vN · date · P/T pass", a recall
   Sparkline, right-aligned RECALL/PREC/CITE readouts, and a chevron — the
   whole card activates → navigates to the agent's Eval Dashboard screen
   (AC-3, AC-5). An agent with cases but zero runs renders without metrics
   and without a sparkline, offering a `Run eval` CTA instead (AC-4).
   Presenter only: no fetching, no mutation. */
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon, Sparkline } from "@devdigest/ui";
import type { EvalAgentSummary } from "@devdigest/shared";
import {
  AGENT_CARD_SPARKLINE_HEIGHT,
  AGENT_CARD_SPARKLINE_WIDTH,
  EVAL_METRIC_COLORS,
  METRIC_READOUT_FIELDS,
} from "./constants";
import { formatRanAt } from "./helpers";
import { readoutValueColor, s } from "./styles";

export interface EvalAgentCardProps {
  agent: EvalAgentSummary;
  onRun: (agentId: string) => void;
  /** Number of this agent's cases currently mid-sweep; 0/undefined = idle. */
  runningCaseCount?: number;
}

export function EvalAgentCard({ agent, onRun, runningCaseCount }: EvalAgentCardProps) {
  const t = useTranslations("eval");
  const router = useRouter();
  const running = !!runningCaseCount && runningCaseCount > 0;
  const hasRun = agent.measured_version !== null && agent.latest !== null;
  const isStale = hasRun && agent.measured_version !== agent.current_version;

  // Whole card activates -> navigate (AC-5). A plain `<div>` (not `<a>`) so
  // the CTA `<button>` below can be a valid, non-nested sibling interactive
  // element rather than a <button> inside an <a>.
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/eval-dashboard/${agent.agent_id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/eval-dashboard/${agent.agent_id}`);
        }
      }}
      style={s.card}
    >
      <div style={s.iconBox}>
        <Icon.Layers size={16} />
      </div>

      <div style={s.main}>
        <div style={s.nameRow}>
          {/* Agent name and model are user-authored — rendered as plain text, never markup. */}
          <span style={s.name}>{agent.name}</span>
          <span className="mono" style={s.modelChip}>
            {agent.model}
          </span>
        </div>

        {hasRun && agent.latest && (
          <span style={s.secondaryLine}>
            {`Last run v${agent.latest.agent_version} · ${formatRanAt(agent.latest.ran_at)} · ${agent.latest.cases_passed}/${agent.latest.cases_total} pass`}
          </span>
        )}

        {isStale && agent.measured_version !== null && (
          <span style={s.staleLabel}>
            {t("agentScreen.lastMeasuredOnVersion", { version: agent.measured_version })}
          </span>
        )}
      </div>

      {hasRun && agent.latest ? (
        <>
          <div style={s.sparklineWrap}>
            <Sparkline
              data={agent.sparkline}
              color={EVAL_METRIC_COLORS.recall}
              w={AGENT_CARD_SPARKLINE_WIDTH}
              h={AGENT_CARD_SPARKLINE_HEIGHT}
            />
          </div>

          <div style={s.readouts}>
            {METRIC_READOUT_FIELDS.map((field) => {
              const latest = agent.latest;
              if (!latest) return null;
              return (
                <div key={field} style={s.readoutCol}>
                  <span style={s.readoutLabel}>
                    {t(`dashboard.metrics.${field === "citation_accuracy" ? "citationAccuracy" : field}`)}
                  </span>
                  <span style={{ ...s.readoutValue, ...readoutValueColor(EVAL_METRIC_COLORS[field]) }}>
                    {Math.round(latest[field] * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <button
          type="button"
          style={s.ctaButton}
          disabled={running}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRun(agent.agent_id);
          }}
        >
          <Icon.Play size={12} />
          {running ? t("dashboard.running") : t("dashboard.runEval", { count: agent.cases_total })}
        </button>
      )}

      <Icon.ChevronRight size={16} style={s.chevron} />
    </div>
  );
}
