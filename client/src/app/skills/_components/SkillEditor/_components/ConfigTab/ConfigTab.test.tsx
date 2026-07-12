import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";

const mutate = vi.fn();
vi.mock("../../../../../../lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate, isPending: false }),
}));
vi.mock("../../../../../../lib/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import { ConfigTab } from "./ConfigTab";

afterEach(() => {
  cleanup();
  mutate.mockClear();
});

const SKILL: Skill = {
  id: "sk1",
  name: "pr-quality-rubric",
  description: "Multi-section PR rubric",
  type: "rubric",
  source: "manual",
  body: "# Rubric\noriginal",
  enabled: true,
  version: 3,
  evidence_files: null,
  context_docs: [],
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("ConfigTab", () => {
  it("Save sends the current fields without summary when the body is unchanged", () => {
    renderWithIntl(<ConfigTab skill={SKILL} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mutate).toHaveBeenCalledTimes(1);
    const arg = mutate.mock.calls[0]![0];
    expect(arg).toEqual({
      id: "sk1",
      patch: {
        name: "pr-quality-rubric",
        description: "Multi-section PR rubric",
        type: "rubric",
        body: "# Rubric\noriginal",
        enabled: true,
      },
    });
    expect(arg.patch).not.toHaveProperty("summary");
  });

  it("reveals the summary field once the body is dirty and includes it on save", () => {
    const { container } = renderWithIntl(<ConfigTab skill={SKILL} />);
    // The summary field is hidden until the body changes.
    expect(screen.queryByPlaceholderText("e.g. Tightened scope rule")).toBeNull();

    const textarea = container.querySelector("textarea")!;
    fireEvent.change(textarea, { target: { value: "# Rubric\nedited" } });

    const summary = screen.getByPlaceholderText("e.g. Tightened scope rule");
    fireEvent.change(summary, { target: { value: "Tightened scope rule" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const arg = mutate.mock.calls[0]![0];
    expect(arg.patch.body).toBe("# Rubric\nedited");
    expect(arg.patch.summary).toBe("Tightened scope rule");
  });
});
