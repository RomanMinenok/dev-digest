import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, Skill, AgentSkillLink } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/agents.json";

// ---- mock the data hooks ----
const setMutate = vi.fn();
let skillsData: Skill[] = [];
let linksData: AgentSkillLink[] = [];

vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: skillsData }),
  useAgentSkills: () => ({ data: linksData }),
  useSetAgentSkills: () => ({ mutate: setMutate, isPending: false }),
}));

import { SkillsTab } from "./SkillsTab";

const AGENT = { id: "ag1", name: "Reviewer" } as Agent;

function skill(id: string, name: string): Skill {
  return {
    id,
    name,
    description: "",
    type: "custom",
    source: "manual",
    body: "x",
    enabled: true,
    version: 1,
    context_docs: [],
  };
}

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <SkillsTab agent={AGENT} />
    </NextIntlClientProvider>,
  );
}

/** The checkbox for a given skill name (its aria-label). */
function checkbox(name: string) {
  return screen.getByRole("checkbox", { name });
}

/** The "Save skills" button. */
function saveButton() {
  return screen.getByRole("button", { name: "Save skills" });
}

beforeEach(() => {
  setMutate.mockClear();
  skillsData = [skill("s1", "alpha"), skill("s2", "beta"), skill("s3", "gamma")];
  linksData = [{ agent_id: "ag1", skill_id: "s2", order: 0 }];
});

afterEach(cleanup);

describe("agent SkillsTab", () => {
  it("shows linked-of-total enabled count", () => {
    renderTab();
    expect(screen.getByText("1 of 3 enabled")).toBeInTheDocument();
  });

  it("does not persist a membership change until Save is pressed", () => {
    renderTab();
    fireEvent.click(checkbox("alpha")); // draft edit only
    expect(setMutate).not.toHaveBeenCalled();
  });

  it("persists the new skill_ids on Save when linking a skill", () => {
    renderTab();
    fireEvent.click(checkbox("alpha")); // link s1 (appended after linked s2)
    fireEvent.click(saveButton());
    expect(setMutate).toHaveBeenCalledWith({ agentId: "ag1", skill_ids: ["s2", "s1"] });
  });

  it("persists the remaining skill_ids on Save when unlinking a skill", () => {
    renderTab();
    fireEvent.click(checkbox("beta")); // unlink s2
    fireEvent.click(saveButton());
    expect(setMutate).toHaveBeenCalledWith({ agentId: "ag1", skill_ids: [] });
  });

  it("persists the reordered linked ids on Save after drag-drop", () => {
    // Two linked skills so a reorder is possible.
    linksData = [
      { agent_id: "ag1", skill_id: "s2", order: 0 },
      { agent_id: "ag1", skill_id: "s1", order: 1 },
    ];
    renderTab();

    const rows = screen.getAllByRole("checkbox").map((cb) => cb.closest("[draggable]")!);
    const [rowS2, rowS1] = rows; // rowS2 = linked idx 0, rowS1 = linked idx 1
    // Drag s1 onto s2.
    fireEvent.dragStart(rowS1!);
    fireEvent.dragOver(rowS2!);
    fireEvent.drop(rowS2!);
    fireEvent.click(saveButton());

    expect(setMutate).toHaveBeenCalledWith({ agentId: "ag1", skill_ids: ["s1", "s2"] });
  });

  it("renders the skill type badge", () => {
    renderTab();
    expect(within(screen.getByText("beta").closest("[draggable]")!).getByText("custom")).toBeInTheDocument();
  });
});
