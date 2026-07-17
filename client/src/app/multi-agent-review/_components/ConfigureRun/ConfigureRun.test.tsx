/* ConfigureRun — AC-17 (empty state), AC-5b (navigate to results once a run is
   started), and the global nav entry's landing rule: with no PR in the URL,
   the active repo's latest run wins and this screen is only for repos that
   have never had one. AC-5b is the one that matters most here: the whole point
   of the route split is that starting a run leaves this page. */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import multiAgentMessages from "../../../../../messages/en/multiAgent.json";
import runsMessages from "../../../../../messages/en/runs.json";

const push = vi.fn();
const replace = vi.fn();
let searchParams = new URLSearchParams("");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => searchParams,
}));

let activeRepoId: string | null = "repo1";
vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({ repoId: activeRepoId, reposLoaded: true }),
}));

// The pointer query's three states the page branches on: still loading, a run
// exists, no run at all.
let latestRun: { data: { id: string; pr_id: string } | null; isLoading: boolean } = {
  data: null,
  isLoading: false,
};
vi.mock("@/lib/hooks/multi-agent", () => ({
  useLatestMultiAgentRunForRepo: () => latestRun,
}));

// AppShell calls useRouter() internally via useGlobalShortcuts and crashes in
// RTL ("invariant expected app router to be mounted") — mock it away entirely
// rather than try to satisfy Next's internals (client/INSIGHTS.md).
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mutate = vi.fn((_vars: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
vi.mock("@/lib/hooks/reviews", () => ({
  useRunReview: () => ({ mutate, isPending: false }),
}));

vi.mock("./PrPicker", () => ({
  PrPicker: () => <div data-testid="pr-picker" />,
}));

// Stubbed so the test drives ConfigureRun's own onRun handler directly — the
// picker's internals are AgentRunPicker's own concern.
vi.mock("@/components/agentRunPicker", () => ({
  AgentRunPicker: ({ onRun }: { onRun: (ids: string[]) => void }) => (
    <button type="button" onClick={() => onRun(["a1", "a2"])}>
      run-stub
    </button>
  ),
}));

import { ConfigureRun } from "./ConfigureRun";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  searchParams = new URLSearchParams("");
  activeRepoId = "repo1";
  latestRun = { data: null, isLoading: false };
});

function renderConfigure() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ multiAgent: multiAgentMessages, runs: runsMessages }}>
      <ConfigureRun />
    </NextIntlClientProvider>,
  );
}

describe("ConfigureRun", () => {
  it("shows the empty state and no agent picker when no PR is selected (AC-17)", () => {
    renderConfigure();
    expect(screen.getByText("Pick a pull request first")).toBeInTheDocument();
    expect(screen.queryByText("run-stub")).not.toBeInTheDocument();
  });

  it("offers the agent picker whenever a PR is selected (AC-8)", () => {
    searchParams = new URLSearchParams("pr=pr1");
    renderConfigure();
    expect(screen.getByText("run-stub")).toBeInTheDocument();
    expect(screen.queryByText("Pick a pull request first")).not.toBeInTheDocument();
  });

  it("navigates to the results route once the run is created (AC-5b)", () => {
    searchParams = new URLSearchParams("pr=pr1");
    renderConfigure();
    fireEvent.click(screen.getByText("run-stub"));

    expect(mutate).toHaveBeenCalledWith(
      { prId: "pr1", agentIds: ["a1", "a2"] },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(push).toHaveBeenCalledWith("/multi-agent-review/results?pr=pr1");
  });

  it("stays put when the run fails to start (AC-5b)", () => {
    searchParams = new URLSearchParams("pr=pr1");
    // A failed mutation never invokes onSuccess.
    mutate.mockImplementationOnce(() => undefined);
    renderConfigure();
    fireEvent.click(screen.getByText("run-stub"));

    expect(push).not.toHaveBeenCalled();
  });

  it("redirects to the active repo's latest run when the URL carries no PR", () => {
    latestRun = { data: { id: "run1", pr_id: "pr9" }, isLoading: false };
    renderConfigure();

    expect(replace).toHaveBeenCalledWith("/multi-agent-review/results?pr=pr9");
    // Never flashes the empty state on the way out.
    expect(screen.queryByText("Pick a pull request first")).not.toBeInTheDocument();
  });

  it("holds the empty state back while the latest run is still unknown", () => {
    latestRun = { data: null, isLoading: true };
    renderConfigure();

    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText("Pick a pull request first")).not.toBeInTheDocument();
  });

  it("keeps the user on Configure when a PR is already in the URL", () => {
    // Results' back button lands here with `?pr=`, so a redirect would bounce
    // the user straight back into the screen they just left.
    searchParams = new URLSearchParams("pr=pr1");
    latestRun = { data: { id: "run1", pr_id: "pr9" }, isLoading: false };
    renderConfigure();

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("run-stub")).toBeInTheDocument();
  });

  it("shows the empty state when no repo is selected yet", () => {
    activeRepoId = null;
    renderConfigure();

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("Pick a pull request first")).toBeInTheDocument();
  });
});
