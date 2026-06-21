/** Constants for the Skills master-detail view. */

/** Valid editor tabs, in display order. First entry is the URL default. */
export const VALID_TABS = ["config", "preview", "evals", "stats", "versions"] as const;
export type SkillTab = (typeof VALID_TABS)[number];

/** Default tab when ?tab= is missing/invalid. */
export const DEFAULT_TAB: SkillTab = "preview";

/** Left list column width (px). */
export const LIST_WIDTH = 360;
