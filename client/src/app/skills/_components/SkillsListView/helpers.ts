import type { Skill } from "@devdigest/shared";
import { DEFAULT_TAB, VALID_TABS, type SkillTab } from "./constants";

/** Case-insensitive filter over a skill's name + description + type. */
export function filterSkills(skills: Skill[], search: string): Skill[] {
  const q = search.trim().toLowerCase();
  if (!q) return skills;
  return skills.filter((sk) => `${sk.name} ${sk.description} ${sk.type}`.toLowerCase().includes(q));
}

/** Coerce a raw ?tab= value to a valid editor tab (default preview). */
export function resolveTab(raw: string | null): SkillTab {
  return (VALID_TABS as readonly string[]).includes(raw ?? "") ? (raw as SkillTab) : DEFAULT_TAB;
}
