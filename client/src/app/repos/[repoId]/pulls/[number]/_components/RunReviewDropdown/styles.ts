import type { CSSProperties } from "react";

/** Co-located styles for RunReviewDropdown. Mirrors the positioning rules of
   the shared `Dropdown` kit component (absolute panel, right-aligned) since
   this component owns its own open/close + click-outside logic in order to
   render the <AgentRunPicker/> as custom content. */
export const s = {
  root: { position: "relative", display: "inline-block" },
  panel: {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-strong)",
    borderRadius: 9,
    boxShadow: "var(--shadow-modal)",
    padding: 6,
    zIndex: 40,
    animation: "ddpop .12s ease",
  },
  mergedWarning: {
    display: "flex",
    alignItems: "center",
    padding: "8px 10px",
    fontSize: 13,
    color: "var(--text-secondary)",
  },
} satisfies Record<string, CSSProperties>;
