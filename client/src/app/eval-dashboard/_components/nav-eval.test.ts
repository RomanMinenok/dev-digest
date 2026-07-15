import { describe, it, expect } from "vitest";
import { NAV } from "@devdigest/ui";
import { activeKeyFor } from "@/components/app-shell/helpers";

/**
 * AC-1: the Eval Dashboard is reachable from the sidebar. Wiring is split
 * across two files — only the NAV entry makes it clickable, and activeKeyFor
 * highlights it — so both gates are asserted (client INSIGHTS).
 */
describe("Eval Dashboard nav wiring (AC-1)", () => {
  it("has a clickable NAV entry pointing at /eval-dashboard", () => {
    const items = NAV.flatMap((group) => group.items);
    const evalItem = items.find((it) => it.key === "eval");
    expect(evalItem).toBeDefined();
    expect(evalItem!.href).toBe("/eval-dashboard");
  });

  it("highlights the eval key for eval-dashboard routes", () => {
    expect(activeKeyFor("/eval-dashboard")).toBe("eval");
    expect(activeKeyFor("/eval-dashboard/agent-123")).toBe("eval");
  });
});
