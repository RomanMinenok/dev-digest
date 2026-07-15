import { describe, it, expect } from "vitest";
import { diffPromptLines, promptsAreIdentical } from "./helpers";

/** Pure line-diff coverage (T27 / AC-25, AC-26). */

describe("promptsAreIdentical", () => {
  it("is true for byte-identical prompts and false otherwise", () => {
    expect(promptsAreIdentical("a\nb", "a\nb")).toBe(true);
    expect(promptsAreIdentical("a\nb", "a\nc")).toBe(false);
  });
});

describe("diffPromptLines", () => {
  it("marks unchanged lines as same", () => {
    const diff = diffPromptLines("line1\nline2", "line1\nline2");
    expect(diff.every((l) => l.kind === "same")).toBe(true);
    expect(diff.map((l) => l.text)).toEqual(["line1", "line2"]);
  });

  it("marks an added line as add and a removed line as del", () => {
    const diff = diffPromptLines("keep\nold", "keep\nnew");
    expect(diff).toContainEqual({ kind: "same", text: "keep" });
    expect(diff).toContainEqual({ kind: "del", text: "old" });
    expect(diff).toContainEqual({ kind: "add", text: "new" });
  });

  it("handles a pure insertion", () => {
    const diff = diffPromptLines("a\nc", "a\nb\nc");
    expect(diff).toContainEqual({ kind: "add", text: "b" });
    // The shared lines survive.
    expect(diff.filter((l) => l.kind === "same").map((l) => l.text)).toEqual(["a", "c"]);
  });
});
