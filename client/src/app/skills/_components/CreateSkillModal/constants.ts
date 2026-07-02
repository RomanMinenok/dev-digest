import type { SkillType } from "@devdigest/shared";

/** Selectable skill types in the create form. */
export const TYPE_VALUES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];

/** Default skill type for a new skill. */
export const DEFAULT_TYPE: SkillType = "custom";

/** Modal width (px). */
export const MODAL_WIDTH = 620;
