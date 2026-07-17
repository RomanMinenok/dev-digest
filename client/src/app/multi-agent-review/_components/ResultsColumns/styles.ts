import type { CSSProperties } from "react";

/** Co-located styles for ResultsColumns. The `root`/`contextStrip` styles that
    used to live here moved to `results/_components/ResultsScreen` along with
    the header row and totals — this component is now just the lanes grid. */
export const s = {
  grid: {
    display: "flex",
    gap: 14,
    overflowX: "auto",
    alignItems: "flex-start",
  } satisfies CSSProperties,
} as const;
