/* /multi-agent-review — global, always PR-scoped via `?pr=<id>` (SPEC-05,
   T-24). This page is a client component that reads `useSearchParams`, which
   requires a <Suspense> boundary in Next.js 15 or the route bails out to
   full CSR. The actual page body (empty state / Configure run / latest-run
   seam) lives in `_components/ConfigureRun` — kept a Container/Presenter
   split so T-25/T-26/T-27 can slot the results UI in without touching this
   file's chrome. */
"use client";

import React from "react";
import { ConfigureRun } from "./_components/ConfigureRun";

export default function MultiAgentReviewPage() {
  return (
    <React.Suspense fallback={null}>
      <ConfigureRun />
    </React.Suspense>
  );
}
