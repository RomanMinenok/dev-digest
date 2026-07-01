import type { SkillType } from "@devdigest/shared";

/** Selectable skill types in the import preview. */
export const TYPE_VALUES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];

/** Accepted upload extensions (matches the server's import/preview route). */
export const ACCEPT = ".md,.markdown,.txt,.zip";

/** Drawer width (px). */
export const DRAWER_WIDTH = 640;
