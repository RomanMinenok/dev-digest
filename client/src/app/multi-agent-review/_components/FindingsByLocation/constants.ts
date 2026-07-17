/* FindingsByLocation/constants.ts — non-copy magic values for the "Findings
   by location" matrix (SPEC-05, T-27 — AC-33, AC-36..AC-43). Copy lives in
   client/messages/en/multiAgent.json ("byLocation" namespace, T-28), plus
   the reused `runs.conflicts.didNotFlag` key — see FindingsByLocation.tsx. */

export const FILTER_ALL = "all" as const;
export const FILTER_MATCHED = "matched" as const;
export const FILTER_DIVERGENT = "divergent" as const;
export const FILTER_AGREED = "agreed" as const;
export type LocationFilter =
  | typeof FILTER_ALL
  | typeof FILTER_MATCHED
  | typeof FILTER_DIVERGENT
  | typeof FILTER_AGREED;

/** AC-39: All is the default — every group shown, not pre-filtered. */
export const DEFAULT_FILTER: LocationFilter = FILTER_ALL;

/** Order the four filter buttons render in (AC-38). */
export const FILTER_ORDER: LocationFilter[] = [FILTER_ALL, FILTER_MATCHED, FILTER_DIVERGENT, FILTER_AGREED];

/** Maps each filter to its i18n message key (under "byLocation") — an
    identifier mapping, not copy itself. */
export const FILTER_MESSAGE_KEY: Record<LocationFilter, string> = {
  all: "byLocation.filterAll",
  matched: "byLocation.filterMatched",
  divergent: "byLocation.filterDivergent",
  agreed: "byLocation.filterAgreed",
};
