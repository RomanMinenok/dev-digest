import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { EvalVersionRun } from "@devdigest/shared";
import messages from "../../../../../../messages/en/eval.json";
import { CompareRunsModal } from "./CompareRunsModal";
import { useAgentVersion } from "@/lib/hooks/eval-dashboard";

vi.mock("@/lib/hooks/eval-dashboard", () => ({ useAgentVersion: vi.fn() }));

const mockUseAgentVersion = vi.mocked(useAgentVersion);

afterEach(cleanup);
beforeEach(() => mockUseAgentVersion.mockReset());

// precision/citation are held constant (and distinct from the recall values)
// so 80%/90% appear exactly once — for the recall card only.
function run(version: number, recall: number): EvalVersionRun {
  return {
    agent_id: "a1",
    agent_name: "Alpha",
    agent_version: version,
    ran_at: "2026-06-01T00:00:00.000Z",
    recall,
    precision: 0.55,
    citation_accuracy: 0.65,
    cases_passed: 18,
    cases_total: 20,
    cost_usd: 0.2,
  };
}

/** Mock useAgentVersion to resolve a prompt per version. */
function withPrompts(byVersion: Record<number, { prompt?: string; error?: boolean }>) {
  mockUseAgentVersion.mockImplementation((_agentId, version) => {
    const entry = version != null ? byVersion[version] : undefined;
    if (entry?.error) {
      return { data: undefined, isError: true, isLoading: false } as ReturnType<typeof useAgentVersion>;
    }
    return {
      data: { config: { system_prompt: entry?.prompt ?? "" } },
      isError: false,
      isLoading: false,
    } as unknown as ReturnType<typeof useAgentVersion>;
  });
}

function renderModal(pair: [EvalVersionRun, EvalVersionRun]) {
  render(
    <NextIntlClientProvider locale="en" messages={{ eval: messages }}>
      <CompareRunsModal agentId="a1" pair={pair} onClose={vi.fn()} />
    </NextIntlClientProvider>
  );
}

describe("CompareRunsModal", () => {
  it("renders old→new metric deltas (AC-24)", () => {
    withPrompts({ 6: { prompt: "p" }, 7: { prompt: "p" } });
    renderModal([run(7, 0.9), run(6, 0.8)]);
    expect(screen.getByText("80%")).toBeInTheDocument(); // old (v6)
    expect(screen.getByText("90%")).toBeInTheDocument(); // new (v7)
    expect(screen.getByText("+10pp")).toBeInTheDocument();
  });

  it("shows 'No prompt changes' when the two prompts are identical (AC-26)", () => {
    withPrompts({ 6: { prompt: "same" }, 7: { prompt: "same" } });
    renderModal([run(7, 0.9), run(6, 0.8)]);
    expect(screen.getByText("No prompt changes")).toBeInTheDocument();
  });

  it("renders the line-level diff as plain text when prompts differ (AC-25, AC-28)", () => {
    withPrompts({ 6: { prompt: "keep\nold" }, 7: { prompt: "keep\nnew" } });
    renderModal([run(7, 0.9), run(6, 0.8)]);
    // Added/removed lines appear verbatim as text nodes (not markup).
    expect(screen.getByText("old")).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument();
  });

  it("still renders the deltas but a 'Prompt unavailable' note when a snapshot 404s (AC-27)", () => {
    withPrompts({ 6: { prompt: "p" }, 7: { error: true } });
    renderModal([run(7, 0.9), run(6, 0.8)]);
    expect(screen.getByText("+10pp")).toBeInTheDocument(); // deltas survive
    expect(screen.getByText("Prompt unavailable")).toBeInTheDocument();
  });

  it("has a Close control and NO Promote button (AC-29)", () => {
    withPrompts({ 6: { prompt: "p" }, 7: { prompt: "p" } });
    renderModal([run(7, 0.9), run(6, 0.8)]);
    // The footer Close button carries the visible text (the Modal's X icon
    // button uses an aria-label, not text).
    expect(screen.getByText("Close")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /promote/i })).not.toBeInTheDocument();
  });
});
