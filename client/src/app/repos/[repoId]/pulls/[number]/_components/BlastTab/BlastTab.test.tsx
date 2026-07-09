import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { BlastRadius } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

const useBlastMock = vi.fn();
const useExplainBlastMock = vi.fn();

vi.mock("../../../../../../../lib/hooks/blast", () => ({
  useBlast: (...args: unknown[]) => useBlastMock(...args),
  useExplainBlast: (...args: unknown[]) => useExplainBlastMock(...args),
}));

import { BlastTab } from "./BlastTab";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const BLAST: BlastRadius = {
  changed_symbols: [{ name: "rateLimit", file: "src/api.ts", kind: "function" }],
  downstream: [
    {
      symbol: "rateLimit",
      callers: [{ name: "publicRouter", file: "src/router.ts", line: 42 }],
      endpoints_affected: ["GET /public"],
      crons_affected: [],
    },
  ],
  status: "full",
  summary: "",
};

function mockExplain(overrides: Partial<{ mutate: () => void; isPending: boolean }> = {}) {
  useExplainBlastMock.mockReturnValue({ mutate: vi.fn(), isPending: false, ...overrides });
}

describe("BlastTab", () => {
  it("renders the tree and reveals a caller link on expand", () => {
    useBlastMock.mockReturnValue({ data: BLAST, isLoading: false, isError: false, refetch: vi.fn() });
    mockExplain();

    renderWithIntl(<BlastTab prId="pr1" repoFullName="acme/widgets" headSha="sha1" />);

    expect(screen.getByText("rateLimit")).toBeInTheDocument();
    expect(screen.queryByText(/publicRouter/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("rateLimit"));

    const link = screen.getByText(/publicRouter/);
    expect(link.closest("a")).toHaveAttribute("href", "https://github.com/acme/widgets/blob/sha1/src/router.ts#L42");
    expect(screen.getByText("GET /public")).toBeInTheDocument();
  });

  it("shows the degraded status badge without crashing", () => {
    useBlastMock.mockReturnValue({
      data: { ...BLAST, status: "degraded" },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockExplain();

    renderWithIntl(<BlastTab prId="pr1" repoFullName="acme/widgets" headSha="sha1" />);

    expect(screen.getByText("Degraded")).toBeInTheDocument();
  });

  it("clicking Explain triggers the mutation and the returned summary is shown", () => {
    useBlastMock.mockReturnValue({
      data: { ...BLAST, summary: "This change reaches one public endpoint." },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const mutate = vi.fn();
    mockExplain({ mutate });

    renderWithIntl(<BlastTab prId="pr1" repoFullName="acme/widgets" headSha="sha1" />);

    fireEvent.click(screen.getByText("Explain"));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(screen.getByText("This change reaches one public endpoint.")).toBeInTheDocument();
  });
});
