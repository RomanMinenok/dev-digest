import { AgentEvalView } from "./_components/AgentEvalView";

/* Route: /eval-dashboard/[agentId] (per-agent Eval Dashboard screen, mock 02).
   Thin route entry — `params` is async in Next 15, so this stays a server
   component that awaits it once and hands a plain string down; all data
   fetching, loading/error/empty states and rendering live in
   _components/AgentEvalView. */
export default async function AgentEvalPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return <AgentEvalView agentId={agentId} />;
}
