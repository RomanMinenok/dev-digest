import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { EvalAgentSummary, EvalVersionRun } from "@devdigest/shared";
import messages from "../../../../../messages/en/eval.json";
import { EvalAgentCard } from "./EvalAgentCard";

// EvalAgentCard uses useRouter for whole-card navigation.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(cleanup);

function latest(version: number): EvalVersionRun {
  return {
    agent_id: "a1",
    agent_name: "Alpha",
    agent_version: version,
    ran_at: "2026-05-29T09:14:00.000Z",
    recall: 0.9,
    precision: 0.88,
    citation_accuracy: 0.95,
    cases_passed: 17,
    cases_total: 20,
    cost_usd: 0.23,
  };
}

function renderCard(agent: EvalAgentSummary) {
  render(
    <NextIntlClientProvider locale="en" messages={{ eval: messages }}>
      <EvalAgentCard agent={agent} onRun={vi.fn()} />
    </NextIntlClientProvider>
  );
}

describe("EvalAgentCard", () => {
  it("shows a Run eval CTA and no metric readouts for an agent with cases but zero runs (AC-4)", () => {
    renderCard({
      agent_id: "a1",
      name: "Alpha",
      model: "gpt-4.1",
      cases_total: 5,
      current_version: 3,
      measured_version: null,
      latest: null,
      sparkline: [],
    });
    expect(screen.getByText("Run eval (5)")).toBeInTheDocument();
    // No metric was ever measured → the RECALL/PREC/CITE readouts must be absent
    // (never rendered as 0%).
    expect(screen.queryByText("RECALL")).not.toBeInTheDocument();
  });

  it("labels the metrics with the last measured version when it lags the current config (AC-12)", () => {
    renderCard({
      agent_id: "a1",
      name: "Alpha",
      model: "gpt-4.1",
      cases_total: 20,
      current_version: 7,
      measured_version: 6,
      latest: latest(6),
      sparkline: [0.8, 0.85, 0.9],
    });
    expect(screen.getByText("last measured on v6")).toBeInTheDocument();
    expect(screen.getByText("RECALL")).toBeInTheDocument();
  });
});
