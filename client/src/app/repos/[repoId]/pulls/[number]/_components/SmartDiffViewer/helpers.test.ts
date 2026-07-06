import { describe, it, expect } from "vitest";
import type { FindingRecord, ReviewRecord } from "@devdigest/shared";
import { findingForLine, sessionWindowFindings } from "./helpers";

function finding(overrides: Partial<FindingRecord> = {}): FindingRecord {
  return {
    id: "f1",
    severity: "WARNING",
    category: "bug",
    title: "title",
    file: "src/a.ts",
    start_line: 10,
    end_line: 12,
    rationale: "rationale",
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...overrides,
  };
}

function review(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "r1",
    pr_id: "pr1",
    agent_id: null,
    run_id: null,
    kind: "review",
    verdict: null,
    summary: null,
    score: null,
    model: null,
    created_at: new Date().toISOString(),
    findings: [],
    ...overrides,
  };
}

describe("findingForLine", () => {
  it("matches on file + start_line", () => {
    const findings = [finding({ id: "f1", file: "src/a.ts", start_line: 10, end_line: 12 })];
    expect(findingForLine(findings, "src/a.ts", 10)?.id).toBe("f1");
  });

  it("does not match a different file with the same line", () => {
    const findings = [finding({ id: "f1", file: "src/a.ts", start_line: 10, end_line: 12 })];
    expect(findingForLine(findings, "src/b.ts", 10)).toBeUndefined();
  });

  it("matches any line within the inclusive start_line..end_line range", () => {
    const findings = [finding({ id: "f1", file: "src/a.ts", start_line: 10, end_line: 15 })];
    expect(findingForLine(findings, "src/a.ts", 10)?.id).toBe("f1");
    expect(findingForLine(findings, "src/a.ts", 12)?.id).toBe("f1");
    expect(findingForLine(findings, "src/a.ts", 15)?.id).toBe("f1");
  });

  it("does not match a line outside the range", () => {
    const findings = [finding({ id: "f1", file: "src/a.ts", start_line: 10, end_line: 15 })];
    expect(findingForLine(findings, "src/a.ts", 9)).toBeUndefined();
    expect(findingForLine(findings, "src/a.ts", 16)).toBeUndefined();
  });

  it("returns the first match when multiple findings share a file+line", () => {
    const findings = [
      finding({ id: "f1", file: "src/a.ts", start_line: 10, end_line: 12 }),
      finding({ id: "f2", file: "src/a.ts", start_line: 10, end_line: 12 }),
    ];
    expect(findingForLine(findings, "src/a.ts", 10)?.id).toBe("f1");
  });
});

describe("sessionWindowFindings", () => {
  it("excludes reviews outside the 60s session window", () => {
    const now = Date.now();
    const reviews = [
      review({ id: "latest", created_at: new Date(now).toISOString(), findings: [finding({ id: "f1" })] }),
      review({
        id: "stale",
        created_at: new Date(now - 61_000).toISOString(),
        findings: [finding({ id: "f2" })],
      }),
    ];
    const result = sessionWindowFindings(reviews);
    expect(result.map((f) => f.id)).toEqual(["f1"]);
  });

  it("includes reviews within the 60s session window", () => {
    const now = Date.now();
    const reviews = [
      review({ id: "latest", created_at: new Date(now).toISOString(), findings: [finding({ id: "f1" })] }),
      review({
        id: "same-session",
        created_at: new Date(now - 30_000).toISOString(),
        findings: [finding({ id: "f2" })],
      }),
    ];
    const result = sessionWindowFindings(reviews);
    expect(result.map((f) => f.id).sort()).toEqual(["f1", "f2"]);
  });

  it("returns an empty array for no reviews", () => {
    expect(sessionWindowFindings([])).toEqual([]);
  });
});
