import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, SkillStats } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

let stats: SkillStats;
vi.mock("../../../../../../lib/hooks/skills", () => ({
  useSkillStats: () => ({ data: stats, isLoading: false, isError: false, refetch: vi.fn() }),
}));

import { StatsTab } from "./StatsTab";

afterEach(() => {
  cleanup();
  push.mockClear();
});

const SKILL: Skill = {
  id: "sk1",
  name: "pr-quality-rubric",
  description: "rubric",
  type: "rubric",
  source: "manual",
  body: "# Rubric",
  enabled: true,
  version: 1,
  evidence_files: null,
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("StatsTab", () => {
  it("shows the real USED BY count and 'no data yet' for the null placeholder metrics", () => {
    stats = {
      skill_id: "sk1",
      used_by: 2,
      agents: [
        { id: "a1", name: "API Contract Reviewer" },
        { id: "a2", name: "Test Quality Reviewer" },
      ],
      pull_rate: null,
      accept_rate: null,
      findings_30d: null,
      findings_by_category: null,
    };
    renderWithIntl(<StatsTab skill={SKILL} />);
    expect(screen.getByText("2")).toBeInTheDocument(); // USED BY value
    // Three null metrics + findings-by-category placeholder all read "no data yet".
    expect(screen.getAllByText("no data yet").length).toBeGreaterThanOrEqual(3);
  });

  it("lists the using agents and navigates to the agent's skills tab", () => {
    stats = {
      skill_id: "sk1",
      used_by: 1,
      agents: [{ id: "a1", name: "API Contract Reviewer" }],
      pull_rate: null,
      accept_rate: null,
      findings_30d: null,
      findings_by_category: null,
    };
    renderWithIntl(<StatsTab skill={SKILL} />);
    expect(screen.getByText("API Contract Reviewer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(push).toHaveBeenCalledWith("/agents/a1?tab=skills");
  });
});
