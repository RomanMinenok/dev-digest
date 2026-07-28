import type { CiTarget } from "@devdigest/shared";
import type { IconName } from "@devdigest/ui";

/** Zero-based wizard step indices — Target → Preview → Configure → Install (AC-1). */
export type WizardStepIndex = 0 | 1 | 2 | 3;

export const WIZARD_STEP_COUNT = 4;

export const EXPORT_WIZARD_WIDTH = 800;

export type TargetCardDef = {
  id: CiTarget;
  icon: IconName;
  /** When true the card is not selectable (AC-2). */
  disabled: boolean;
  recommended?: boolean;
};

/** Target cards in display order (2×2 grid per mock 01-wizard-target.png). */
export const TARGET_CARDS: TargetCardDef[] = [
  { id: "gha", icon: "GitBranch", disabled: false, recommended: true },
  { id: "circle", icon: "Activity", disabled: true },
  { id: "jenkins", icon: "Settings", disabled: true },
  { id: "cli", icon: "Command", disabled: true },
];

export const SELECTABLE_TARGETS = new Set<CiTarget>(["gha"]);
