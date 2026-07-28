/* AgentRunPicker — shared "pick which agents to run" widget (SPEC-05, T-21).
   Renders one checkbox per workspace agent with a time/cost hint, a "Clear"
   action, an optional "Select all" action (T-24b, `showSelectAll`, AC-8), a
   primary "Run multi-agent review (N)" button (disabled at N = 0), and a
   "Configure agents…" footer link. There is deliberately no single-click
   bulk-execution control and no per-agent standalone execution action
   anywhere (AC-4) — "Select all" only checks boxes, it never triggers a
   run itself; a run still requires the single primary button. Selection
   state is owned here; the
   parent only learns the final `agentIds` when the run button is clicked.
   Used by both the PR page's Run Review dropdown (T-22, `showSelectAll`
   omitted) and the Configure-run page (T-24/T-24b, `showSelectAll`). */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Checkbox, Icon } from "@devdigest/ui";
import { useAgents } from "@/lib/hooks/agents";
import { useAgentEstimates } from "@/lib/hooks/multi-agent";
import type { Agent, AgentEstimate } from "@devdigest/shared";
import { CONFIGURE_AGENTS_ROUTE } from "./constants";
import { agentHint, estimateTotals, totalsLabel } from "./helpers";
import { s } from "./styles";

export interface AgentRunPickerProps {
  /** Fired with the checked agent ids when "Run multi-agent review" is clicked. */
  onRun: (agentIds: string[]) => void;
  /** Disables the run button and shows the loading state on it. */
  isRunning?: boolean;
  /** T-24b (AC-8) — when `true`, renders a "Select all" action next to
      "Clear" that checks every agent in the list. This is a *selection*
      affordance only (AC-4 still applies: no single-click bulk-execution
      control exists). Defaults to `false` so the PR dropdown (T-22) is
      byte-identical in behaviour. */
  showSelectAll?: boolean;
}

export function AgentRunPicker({ onRun, isRunning = false, showSelectAll = false }: AgentRunPickerProps) {
  const router = useRouter();
  const t = useTranslations("multiAgent");
  // "Configure agents…" is reused verbatim from the PR-review dropdown's
  // namespace rather than duplicated under a new key (client/INSIGHTS.md:
  // a component pulling from two `useTranslations` namespaces is accepted).
  const tPr = useTranslations("prReview");
  const { data: agents } = useAgents();
  const { data: estimates } = useAgentEstimates();
  const [checked, setChecked] = React.useState<Set<string>>(new Set());

  const all: Agent[] = agents ?? [];
  const estimateByAgent = new Map<string, AgentEstimate>((estimates ?? []).map((e) => [e.agent_id, e]));

  const toggle = (agentId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  const clear = () => setChecked(new Set());
  const selectAll = () => setChecked(new Set(all.map((agent) => agent.id)));

  const checkedEstimates = [...checked]
    .map((id) => estimateByAgent.get(id))
    .filter((e): e is AgentEstimate => e !== undefined);
  const totals = totalsLabel(estimateTotals(checkedEstimates), t("picker.fanOut"));

  if (all.length === 0) {
    return (
      <div style={s.root}>
        <button type="button" style={s.emptyRow} onClick={() => router.push(CONFIGURE_AGENTS_ROUTE)}>
          <Icon.Plus size={15} />
          {t("picker.noAgents")}
        </button>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <div style={s.headerRow}>
        <span style={s.headerLabel}>{t("picker.header")}</span>
        <div style={s.headerActions}>
          {showSelectAll && (
            <button type="button" style={s.clearLink} onClick={selectAll}>
              {t("picker.selectAll")}
            </button>
          )}
          <button type="button" style={s.clearLink} onClick={clear}>
            {t("picker.clear")}
          </button>
        </div>
      </div>

      <div style={s.list}>
        {all.map((agent) => (
          <div key={agent.id} style={s.row}>
            <Checkbox checked={checked.has(agent.id)} onChange={() => toggle(agent.id)} />
            <Icon.Cpu size={16} style={s.rowIcon} />
            <div style={s.rowBody}>
              <span style={s.rowName}>{agent.name}</span>
              {agent.description && <span style={s.rowGist}>{agent.description}</span>}
            </div>
            <span style={s.rowHint}>{agentHint(estimateByAgent.get(agent.id), t("picker.noHistory"))}</span>
          </div>
        ))}
      </div>

      <div style={s.footer}>
        <div style={s.footerRow}>
          <Button kind="primary" icon="Users" disabled={checked.size === 0} loading={isRunning} onClick={() => onRun([...checked])}>
            {t("picker.runButton", { count: checked.size })}
          </Button>
          {totals && <span style={s.totals}>{totals}</span>}
        </div>
        <button
          type="button"
          style={s.configureLink}
          onClick={() => router.push(CONFIGURE_AGENTS_ROUTE)}
        >
          {tPr("runReview.configureAgents")}
        </button>
      </div>
    </div>
  );
}
