import { EvalDashboardView } from "./_components/EvalDashboardView";

/* Route: /eval-dashboard (workspace-wide Eval Dashboard, mock 01). Thin route
   entry — data fetching, the AGENTS section and the cross-agent run list are
   colocated under _components/EvalDashboardView. */
export default function EvalDashboardPage() {
  return <EvalDashboardView />;
}
