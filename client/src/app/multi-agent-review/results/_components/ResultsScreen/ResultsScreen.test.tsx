/* ResultsScreen — AC-18 (render the latest run for the PR in the URL; redirect
   to Configure run when there is none) and AC-18b (a control back to Configure
   run). The heavy children (lanes/tabs/matrix/drawer) are stubbed: what's under
   test here is the screen's own chrome and its routing decisions. */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { MultiAgentRunView } from "@devdigest/shared";
import multiAgentMessages from "../../../../../../messages/en/multiAgent.json";
import runsMessages from "../../../../../../messages/en/runs.json";

const push = vi.fn();
const replace = vi.fn();
let searchParams = new URLSearchParams("pr=pr1");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

let latestRun: { data: MultiAgentRunView | null; isLoading: boolean; isError: boolean; error?: unknown; refetch: () => void };
let capturedOnRunClosed: ((runId: string) => void) | undefined;
vi.mock("@/lib/hooks/multi-agent", () => ({
  useLatestMultiAgentRun: () => latestRun,
}));
vi.mock("@/lib/hooks/core", () => ({
  usePullDetail: () => ({ data: { number: 482, title: "Add rate limiting to public API endpoints" } }),
}));
vi.mock("@/lib/hooks/reviews", () => ({
  useRunEvents: (_ids: string[], opts?: { onRunClosed?: (runId: string) => void }) => {
    capturedOnRunClosed = opts?.onRunClosed;
    return { events: [], running: false };
  },
}));

vi.mock("../../../_components/ResultsColumns", () => ({
  ResultsColumns: () => <div data-testid="lanes" />,
}));
vi.mock("../../../_components/ResultsTabs", () => ({
  ResultsTabs: () => <div data-testid="tabs-pane" />,
}));
vi.mock("../../../_components/FindingsByLocation", () => ({
  FindingsByLocation: () => <div data-testid="by-location" />,
}));
vi.mock("@/components/RunTraceDrawer", () => ({ RunTraceDrawer: () => null }));

import { ResultsScreen } from "./ResultsScreen";

function runFixture(): MultiAgentRunView {
  return {
    id: "mr1",
    pr_id: "pr1",
    ran_at: new Date().toISOString(),
    status: "done",
    members: [
      { agent_id: "a1", agent_name: "Security", status: "done", score: 38, duration_ms: 8200, cost_usd: 0.06, error: null, run_id: "r1", findings: [] },
      { agent_id: "a2", agent_name: "Performance", status: "done", score: 64, duration_ms: 7400, cost_usd: 0.05, error: null, run_id: "r2", findings: [] },
    ],
    groups: [],
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  searchParams = new URLSearchParams("pr=pr1");
  capturedOnRunClosed = undefined;
});

function renderScreen() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ multiAgent: multiAgentMessages, runs: runsMessages }}>
      <ResultsScreen />
    </NextIntlClientProvider>,
  );
}

describe("ResultsScreen", () => {
  it("renders the latest run's header, context strip and lanes (AC-18)", () => {
    latestRun = { data: runFixture(), isLoading: false, isError: false, refetch: vi.fn() };
    renderScreen();

    expect(screen.getByText("2 selected agents · parallel")).toBeInTheDocument();
    expect(screen.getByText("Add rate limiting to public API endpoints")).toBeInTheDocument();
    expect(screen.getByTestId("lanes")).toBeInTheDocument();
    expect(screen.getByTestId("by-location")).toBeInTheDocument();
    // AC-18: no navigation to earlier runs.
    expect(replace).not.toHaveBeenCalled();
  });

  it("switches between Columns and Tabs over the same run (AC-19)", () => {
    latestRun = { data: runFixture(), isLoading: false, isError: false, refetch: vi.fn() };
    renderScreen();

    expect(screen.getByTestId("lanes")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Tabs"));
    expect(screen.getByTestId("tabs-pane")).toBeInTheDocument();
    expect(screen.queryByTestId("lanes")).not.toBeInTheDocument();
  });

  it("redirects to Configure run when the PR has no multi-agent run (AC-18)", () => {
    latestRun = { data: null, isLoading: false, isError: false, refetch: vi.fn() };
    renderScreen();

    expect(replace).toHaveBeenCalledWith("/multi-agent-review?pr=pr1");
  });

  it("redirects to Configure run when no PR is in the URL", () => {
    searchParams = new URLSearchParams("");
    latestRun = { data: null, isLoading: false, isError: false, refetch: vi.fn() };
    renderScreen();

    expect(replace).toHaveBeenCalledWith("/multi-agent-review");
  });

  it("offers a control back to Configure run for the same PR (AC-18b)", () => {
    latestRun = { data: runFixture(), isLoading: false, isError: false, refetch: vi.fn() };
    renderScreen();

    fireEvent.click(screen.getByText("Configure run"));
    expect(push).toHaveBeenCalledWith("/multi-agent-review?pr=pr1");
  });

  it("refetches the multi-agent run when any agent's SSE closes (not only when all settle)", () => {
    const refetch = vi.fn();
    const base = runFixture();
    latestRun = {
      data: {
        ...base,
        status: "running",
        members: base.members.map((m) => ({
          ...m,
          status: "running" as const,
          score: null,
          duration_ms: null,
          cost_usd: null,
          findings: [],
        })),
      },
      isLoading: false,
      isError: false,
      refetch,
    };
    renderScreen();

    expect(capturedOnRunClosed).toBeTypeOf("function");
    capturedOnRunClosed!("r1");
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
