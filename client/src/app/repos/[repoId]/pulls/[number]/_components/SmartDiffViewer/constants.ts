import type { SmartDiffRole } from "@devdigest/shared";

/** Fixed render order — the contract doesn't guarantee array order. */
export const ROLE_ORDER: SmartDiffRole[] = ["core", "wiring", "boilerplate"];

export const ROLE_TITLE: Record<SmartDiffRole, string> = {
  core: "Core logic",
  wiring: "Wiring",
  boilerplate: "Boilerplate",
};

export const ROLE_SUBTITLE: Record<SmartDiffRole, string> = {
  core: "The substance of the change — review closely",
  wiring: "Hooks the core into the app",
  boilerplate: "Generated / mechanical — skim",
};

/** Role-badge colors (distinct from SEV_COLOR — these mark file role, not severity). */
export const ROLE_COLOR: Record<SmartDiffRole, string> = {
  core: "var(--accent)",
  wiring: "var(--warn)",
  boilerplate: "var(--text-muted)",
};
