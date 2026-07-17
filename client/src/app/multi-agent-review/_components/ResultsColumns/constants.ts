/* ResultsColumns/constants.ts — non-copy magic values for the Columns
   results view (SPEC-05, T-25). Copy lives in
   client/messages/en/multiAgent.json ("results" namespace, T-28). */

export const MODE_COLUMNS = "columns" as const;
export const MODE_TABS = "tabs" as const;
export type ResultsMode = typeof MODE_COLUMNS | typeof MODE_TABS;
