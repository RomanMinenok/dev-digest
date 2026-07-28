/* /multi-agent-review/results — the results screen for a PR's latest
   multi-agent run (SPEC-05 design 04/05). A distinct route, not a state of
   the Configure page: both entry points (the PR page's Run Review dropdown
   and Configure run) navigate here once a run is started, per the spec's own
   flow diagram (`K -> L -> M[Results page]`).

   Client component reading `useSearchParams`, so it needs a <Suspense>
   boundary in Next.js 15 or the route bails out to full CSR — same guard as
   the parent route's page.tsx. */
"use client";

import React from "react";
import { ResultsScreen } from "./_components/ResultsScreen";

export default function MultiAgentResultsPage() {
  return (
    <React.Suspense fallback={null}>
      <ResultsScreen />
    </React.Suspense>
  );
}
