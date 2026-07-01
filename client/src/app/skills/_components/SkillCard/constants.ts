import type { SkillType } from "@devdigest/shared";

/** SkillType → badge colour (token). Falls back to --text-secondary. */
export const TYPE_COLOR: Record<SkillType, string> = {
  rubric: "#3b82f6",
  convention: "#10b981",
  security: "#f59e0b",
  custom: "#8b5cf6",
};
