import type { CSSProperties } from "react";

/** Co-located styles for RangePicker. */
export const s = {
  wrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  } satisfies CSSProperties,
} as const;
