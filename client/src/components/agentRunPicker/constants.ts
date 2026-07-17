/** Non-copy magic values for AgentRunPicker (SPEC-05, T-21). Copy lives in
    `client/messages/en/multiAgent.json` (namespace "picker", T-28) plus a
    reused `prReview.runReview.configureAgents` key — see AgentRunPicker.tsx. */

export const CONFIGURE_AGENTS_ROUTE = "/agents";

/** Digits for cost formatting, trailing zeros trimmed after — mirrors
    `RunTraceDrawer/helpers.ts`'s `formatCost` convention. */
export const COST_FORMAT_DIGITS = Number(process.env.NEXT_PUBLIC_COST_FORMAT_DIGITS) || 4;
