/* AgentsSection — the "AGENTS" list of EvalAgentCards on the workspace-wide
   Eval Dashboard (mock 01). Presenter only: no fetching, no mutation. */

import { useTranslations } from "next-intl";
import type { EvalAgentSummary } from "@devdigest/shared";
import { EvalAgentCard } from "../../../EvalAgentCard";
import { s } from "./styles";

export interface AgentsSectionProps {
  agents: EvalAgentSummary[];
  onRun: (agentId: string) => void;
  runningAgentId?: string | null;
}

export function AgentsSection({ agents, onRun, runningAgentId }: AgentsSectionProps) {
  const t = useTranslations("eval");

  return (
    <div style={s.section}>
      <div style={s.sectionHeading}>{t("overviewPage.agentsHeading")}</div>
      <div>
        {agents.map((agent) => (
          <EvalAgentCard
            key={agent.agent_id}
            agent={agent}
            onRun={onRun}
            runningCaseCount={runningAgentId === agent.agent_id ? 1 : 0}
          />
        ))}
      </div>
    </div>
  );
}
