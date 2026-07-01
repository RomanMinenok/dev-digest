import type { SkillType } from "@devdigest/shared";
import { TYPE_COLOR } from "./constants";

/** Resolve the badge colour for a skill type (unknown → secondary token). */
export function typeColor(type: SkillType): string {
  return TYPE_COLOR[type] ?? "var(--text-secondary)";
}
