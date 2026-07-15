import type { CSSProperties } from "react";
import { METRIC_BAR_TRACK_HEIGHT, METRIC_BAR_TRACK_WIDTH } from "./constants";

/** Co-located styles for MetricBar. */
export const s = {
  wrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,
  track: {
    width: METRIC_BAR_TRACK_WIDTH,
    height: METRIC_BAR_TRACK_HEIGHT,
    borderRadius: 999,
    background: "var(--bg-hover)",
    overflow: "hidden",
    flexShrink: 0,
  } satisfies CSSProperties,
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-primary)",
    fontVariantNumeric: "tabular-nums",
    minWidth: 32,
    textAlign: "right" as const,
  } satisfies CSSProperties,
  unavailable: {
    fontSize: 12,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
};

/** Dynamic fill width/color — depends on props, so it stays a function, not a static object. */
export function fillStyle(fraction: number, color: string): CSSProperties {
  return {
    height: "100%",
    width: `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`,
    background: color,
    borderRadius: 999,
  };
}
