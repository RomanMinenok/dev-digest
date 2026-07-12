import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, SkillVersion } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";

const restoreMutate = vi.fn();
vi.mock("../../../../../../lib/hooks/skills", () => ({
  useSkillVersions: () => ({ data: VERSIONS, isLoading: false, isError: false, refetch: vi.fn() }),
  useSkillVersion: () => ({ data: VERSIONS[0], isLoading: false }),
  useRestoreSkillVersion: () => ({ mutate: restoreMutate, isPending: false }),
}));
vi.mock("../../../../../../lib/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import { VersionsTab } from "./VersionsTab";

const VERSIONS: SkillVersion[] = [
  { skill_id: "sk1", version: 1, summary: "Initial rubric", body: "# v1", created_at: "2026-01-01T00:00:00Z" },
  { skill_id: "sk1", version: 2, summary: "Tightened scope", body: "# v2", created_at: "2026-02-01T00:00:00Z" },
];

const SKILL: Skill = {
  id: "sk1",
  name: "pr-quality-rubric",
  description: "rubric",
  type: "rubric",
  source: "manual",
  body: "# v2",
  enabled: true,
  version: 2,
  evidence_files: null,
  context_docs: [],
};

afterEach(() => {
  cleanup();
  restoreMutate.mockClear();
});

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("VersionsTab", () => {
  it("marks the highest version Current and only older rows get Diff/Restore", () => {
    renderWithIntl(<VersionsTab skill={SKILL} />);
    expect(screen.getByText("Current")).toBeInTheDocument();
    // Only v1 (non-head) exposes the actions.
    expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(1);
    expect(screen.getByText("Initial rubric")).toBeInTheDocument();
  });

  it("opens the diff modal for an older version", () => {
    renderWithIntl(<VersionsTab skill={SKILL} />);
    fireEvent.click(screen.getByRole("button", { name: "Diff" }));
    expect(screen.getByText("Diff — v1 vs current")).toBeInTheDocument();
  });

  it("Restore calls useRestoreSkillVersion with the skill id + version", () => {
    renderWithIntl(<VersionsTab skill={SKILL} />);
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(restoreMutate).toHaveBeenCalledWith(
      { id: "sk1", version: 1 },
      expect.anything(),
    );
  });
});
