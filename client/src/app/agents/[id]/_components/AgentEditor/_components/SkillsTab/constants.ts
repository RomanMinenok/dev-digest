import type { SkillType } from "@devdigest/shared";

/** Per-type badge color, mirrored from the Skills Lab type palette. */
export const TYPE_COLOR: Record<SkillType, string> = {
  rubric: "var(--accent)",
  convention: "var(--info)",
  security: "var(--crit)",
  custom: "var(--text-secondary)",
};
