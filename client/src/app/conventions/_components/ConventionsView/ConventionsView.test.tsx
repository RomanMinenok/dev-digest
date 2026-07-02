import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../messages/en/conventions.json";

// --- mocks (hoisted by vitest before imports) ---

const mockMutate = vi.fn();

vi.mock("../../../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../lib/repo-context", () => ({
  useActiveRepo: vi.fn(),
}));

vi.mock("../../../../lib/hooks/conventions", () => ({
  useConventions: vi.fn(),
  useRescanConventions: vi.fn(),
}));

import { useActiveRepo } from "../../../../lib/repo-context";
import { useConventions, useRescanConventions } from "../../../../lib/hooks/conventions";
import { ConventionsView } from "./ConventionsView";

// ---- fixtures ----------------------------------------------------------------

const CANDIDATES: ConventionCandidate[] = [
  {
    id: "c1",
    rule: "Always use async/await instead of promise chains",
    evidence_path: "src/api.ts",
    evidence_snippet: "const user = await db.users.find(id);",
    confidence: 0.9,
    accepted: false,
  },
  {
    id: "c2",
    rule: "Never use var — use const or let",
    evidence_path: "src/utils.ts",
    evidence_snippet: "const x = 1;",
    confidence: 0.8,
    accepted: false,
  },
];

// ---- helpers -----------------------------------------------------------------

afterEach(cleanup);

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
        <ConventionsView />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

// ---- tests -------------------------------------------------------------------

describe("ConventionsView", () => {
  beforeEach(() => {
    vi.mocked(useActiveRepo).mockReturnValue({
      repoId: "repo-1",
      activeRepo: { id: "repo-1", full_name: "org/repo" } as never,
      reposLoaded: true,
      repos: [],
      setRepoId: vi.fn(),
    } as never);

    vi.mocked(useRescanConventions).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as never);

    mockMutate.mockClear();
  });

  it("renders convention cards from fetched data — rule text and file path visible", () => {
    vi.mocked(useConventions).mockReturnValue({
      data: CANDIDATES,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useConventions>);

    renderView();

    expect(screen.getByText("Always use async/await instead of promise chains")).toBeInTheDocument();
    expect(screen.getByText("Never use var — use const or let")).toBeInTheDocument();
    expect(screen.getByText("src/api.ts")).toBeInTheDocument();
    expect(screen.getByText("src/utils.ts")).toBeInTheDocument();
  });

  it("toolbar shows '2 of 2 accepted' when two candidates load (all default-accepted)", () => {
    vi.mocked(useConventions).mockReturnValue({
      data: CANDIDATES,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useConventions>);

    renderView();

    expect(screen.getByText("2 of 2 accepted")).toBeInTheDocument();
  });

  it("Re-scan button calls mutate when clicked", () => {
    vi.mocked(useConventions).mockReturnValue({
      data: CANDIDATES,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useConventions>);

    renderView();

    fireEvent.click(screen.getByRole("button", { name: /re-scan/i }));
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("Re-scan button shows 'Scanning…' label while isPending is true", () => {
    vi.mocked(useConventions).mockReturnValue({
      data: CANDIDATES,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useConventions>);

    vi.mocked(useRescanConventions).mockReturnValue({ mutate: mockMutate, isPending: true } as never);

    renderView();

    expect(screen.getByText(/scanning/i)).toBeInTheDocument();
  });

  it("renders heading with repo full_name from activeRepo", () => {
    vi.mocked(useConventions).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useConventions>);

    renderView();

    expect(screen.getByText("org/repo")).toBeInTheDocument();
  });

  it("toolbar shows '0 of 0 accepted' and no cards when data is empty", () => {
    vi.mocked(useConventions).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useConventions>);

    renderView();

    expect(screen.getByText("0 of 0 accepted")).toBeInTheDocument();
    expect(screen.queryByText("Always use async/await instead of promise chains")).not.toBeInTheDocument();
  });

  it("falls back to 'repo' placeholder when activeRepo is null", () => {
    vi.mocked(useActiveRepo).mockReturnValue({
      repoId: null,
      activeRepo: null,
      reposLoaded: true,
      repos: [],
      setRepoId: vi.fn(),
    } as never);

    vi.mocked(useConventions).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useConventions>);

    renderView();

    expect(screen.getByText("repo")).toBeInTheDocument();
  });
});
