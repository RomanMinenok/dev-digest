import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useEvalSweep } from "./useEvalSweep";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const mockGet = vi.mocked(api.get);
const mockPost = vi.mocked(api.post);

afterEach(cleanup);
beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
});

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const cases = (ids: string[]) => ids.map((id) => ({ id }));

describe("useEvalSweep (AC-35, AC-36, AC-38)", () => {
  it("runs one POST per case with a truthy body, and ends idle", async () => {
    mockGet.mockResolvedValue(cases(["c1", "c2"]) as never);
    mockPost.mockResolvedValue([] as never);

    const { result } = renderHook(() => useEvalSweep(), { wrapper });
    await act(async () => {
      await result.current.runAgent("a1");
    });

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost).toHaveBeenNthCalledWith(1, "/agents/a1/eval-runs", { case_ids: ["c1"] });
    expect(mockPost).toHaveBeenNthCalledWith(2, "/agents/a1/eval-runs", { case_ids: ["c2"] });
    expect(result.current.isSweeping).toBe(false);
    expect(result.current.runningAgentId).toBeNull();
    expect(result.current.failures).toHaveLength(0);
  });

  it("continues past a rejecting case and surfaces the failure (AC-38)", async () => {
    mockGet.mockResolvedValue(cases(["c1", "c2", "c3"]) as never);
    mockPost
      .mockResolvedValueOnce([] as never)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce([] as never);

    const { result } = renderHook(() => useEvalSweep(), { wrapper });
    await act(async () => {
      await result.current.runAgent("a1");
    });

    // All three were attempted despite the middle one throwing.
    expect(mockPost).toHaveBeenCalledTimes(3);
    expect(result.current.failures).toHaveLength(1);
    expect(result.current.failures[0]!.caseId).toBe("c2");
  });

  it("sweeps agent by agent, case by case, in order (AC-36)", async () => {
    mockGet.mockImplementation((url: string) =>
      Promise.resolve(cases(url.includes("/agents/a1/") ? ["c1"] : ["c2", "c3"]) as never)
    );
    mockPost.mockResolvedValue([] as never);

    const { result } = renderHook(() => useEvalSweep(), { wrapper });
    await act(async () => {
      await result.current.runAgents(["a1", "a2"]);
    });

    expect(mockPost.mock.calls.map((c) => c[0])).toEqual([
      "/agents/a1/eval-runs",
      "/agents/a2/eval-runs",
      "/agents/a2/eval-runs",
    ]);
  });
});
