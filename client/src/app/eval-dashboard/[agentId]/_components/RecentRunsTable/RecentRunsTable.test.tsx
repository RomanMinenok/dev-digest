import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { EvalVersionRun } from "@devdigest/shared";
import messages from "../../../../../../messages/en/eval.json";
import { RecentRunsTable } from "./RecentRunsTable";

afterEach(cleanup);

function makeRun(version: number, ranAt: string): EvalVersionRun {
  return {
    agent_id: "a1",
    agent_name: "Alpha",
    agent_version: version,
    ran_at: ranAt,
    recall: 0.9,
    precision: 0.88,
    citation_accuracy: 0.95,
    cases_passed: 17,
    cases_total: 20,
    cost_usd: 0.23,
  };
}

const RUNS = [
  makeRun(6, "2026-06-01T09:14:00.000Z"),
  makeRun(5, "2026-05-01T09:14:00.000Z"),
  makeRun(4, "2026-04-01T09:14:00.000Z"),
];

function renderTable(onCompare = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ eval: messages }}>
      <RecentRunsTable runs={RUNS} days={30} onCompare={onCompare} />
    </NextIntlClientProvider>
  );
  return onCompare;
}

describe("RecentRunsTable (AC-10, AC-23)", () => {
  it("renders the version chip as non-interactive text", () => {
    renderTable();
    const chip = screen.getByText("v6");
    expect(chip.closest("button")).toBeNull();
    expect(chip.closest("a")).toBeNull();
  });

  it("enables Compare only when exactly two rows are selected", () => {
    const onCompare = renderTable();
    const compare = screen.getByRole("button", { name: "Compare" });
    const checkboxes = screen.getAllByRole("checkbox");

    expect(compare).toBeDisabled(); // 0 selected

    fireEvent.click(checkboxes[0]!);
    expect(compare).toBeDisabled(); // 1 selected

    fireEvent.click(checkboxes[1]!);
    expect(compare).toBeEnabled(); // exactly 2

    fireEvent.click(checkboxes[2]!);
    expect(compare).toBeDisabled(); // 3 selected

    expect(onCompare).not.toHaveBeenCalled();
  });

  it("hands the two selected version runs to onCompare", () => {
    const onCompare = renderTable();
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]!); // v6
    fireEvent.click(checkboxes[1]!); // v5
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));

    expect(onCompare).toHaveBeenCalledTimes(1);
    const pair = onCompare.mock.calls[0]![0] as EvalVersionRun[];
    expect(pair.map((r) => r.agent_version).sort()).toEqual([5, 6]);
  });

  it("shows the empty-range copy when there are no runs", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ eval: messages }}>
        <RecentRunsTable runs={[]} days={7} onCompare={vi.fn()} />
      </NextIntlClientProvider>
    );
    expect(screen.getByText("No runs in the last 7 days")).toBeInTheDocument();
  });
});
