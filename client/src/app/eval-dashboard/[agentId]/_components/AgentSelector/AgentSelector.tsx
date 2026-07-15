/* AgentSelector — the mock's "⚙ Security Reviewer ⌄" control on the agent
   screen. Lists the same agents the dashboard lists (those with ≥ 1 eval case)
   and navigates to `/eval-dashboard/<agentId>` on select, preserving the active
   `days` range. Reuses the shared kit Dropdown and the cached workspace
   dashboard query — no new fetch shape. */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Dropdown, Icon } from "@devdigest/ui";
import type { DropdownItemDef } from "@devdigest/ui";
import { useEvalWorkspaceDashboard } from "@/lib/hooks/eval-dashboard";
import { EVAL_RANGE_DAYS_DEFAULT } from "../../../_components/RangePicker";
import { s } from "./styles";

export interface AgentSelectorProps {
  /** The currently-open agent — shown as the trigger label and marked in the list. */
  agentId: string;
  agentName: string;
}

export function AgentSelector({ agentId, agentName }: AgentSelectorProps) {
  const router = useRouter();
  const search = useSearchParams();

  // The agent list is range-independent (an agent appears iff it owns ≥ 1 case),
  // so the default range maximises cache reuse with the overview page.
  const { data } = useEvalWorkspaceDashboard(EVAL_RANGE_DAYS_DEFAULT);

  const goto = (id: string) => {
    const days = search.get("days");
    const query = days ? `?days=${days}` : "";
    router.push(`/eval-dashboard/${id}${query}`);
  };

  const items: DropdownItemDef[] = (data?.agents ?? []).map((agent) => ({
    label: agent.name,
    icon: "Gauge",
    hint: agent.agent_id === agentId ? "current" : undefined,
    muted: agent.agent_id === agentId,
    onClick: () => {
      if (agent.agent_id !== agentId) goto(agent.agent_id);
    },
  }));

  return (
    <Dropdown
      align="left"
      width={240}
      items={items}
      trigger={
        <button type="button" style={s.trigger}>
          <Icon.Gauge size={15} style={s.chevron} />
          <span>{agentName}</span>
          <Icon.ChevronDown size={14} style={s.chevron} />
        </button>
      }
    />
  );
}
