import type {
  AgentEstimate,
  Finding,
  FindingRecord,
  MultiAgentCell,
  MultiAgentGroup,
  MultiAgentGroupFinding,
  MultiAgentLatestRunPointer,
  MultiAgentMember,
  MultiAgentRunView,
} from '@devdigest/shared';
import type { FindingRow } from '../../db/rows.js';
import type { Container } from '../../platform/container.js';
import { buildCells, type Cell } from './cells.js';
import { estimateForAgent } from './estimate.js';
import { groupByLocation } from './grouping.js';
import type { MemberRunRow, MultiAgentRepository } from './repository.js';
import { isAgreed, isDivergent, isMatched } from './similarity.js';
import { deriveStatus } from './status.js';
import type { AttributedFinding, LocationGroup } from './types.js';

/**
 * Application layer for the "Findings by location" read (SPEC-05, T-13 —
 * AC-14, AC-15, AC-30, AC-31, AC-32, AC-33, AC-35).
 *
 * Fetch → delegate to the pure functions (`grouping.ts`/`similarity.ts`/
 * `status.ts`/`cells.ts`) → map to the snake_case `MultiAgentRunView` DTO.
 * No grouping/classification logic lives here — this file only assembles
 * inputs for the pure functions and shapes their outputs for the wire.
 *
 * Every exit path goes through an explicit DTO mapper below (`toMemberDto`,
 * `toGroupDto`, `toFindingRecord`, `toFinding`, `toCellDto`) — never a raw
 * `$inferSelect` row — per `server/INSIGHTS.md`'s DTO-mapper rule (a service
 * returning camelCase Drizzle rows still typechecks against the client's
 * snake_case contract and breaks only at runtime, since `api.get<T>` is an
 * unchecked cast).
 */
export class MultiAgentService {
  private repo: MultiAgentRepository;

  constructor(private container: Container) {
    this.repo = container.multiAgentRepo;
  }

  /**
   * The latest multi-agent run for a PR, with every member's identity/
   * status/score/duration/cost/error/findings (AC-14), the derived overall
   * status (AC-15), and the "Findings by location" groups computed fresh on
   * every read — nothing about grouping/classification is persisted (AC-31).
   *
   * `MultiAgentRepository.latestForPull` is already scoped by BOTH
   * `workspaceId` AND `prId` on the same query (AC-16), so a request for a
   * PR that belongs to a different workspace and a request for a PR that
   * simply has no multi-agent run yet are indistinguishable at the
   * repository boundary — both come back as `undefined`. This method maps
   * that single "nothing found" case to `null` uniformly (this endpoint's
   * chosen "no run" contract, per the task's "null/404 — pick one"). This is
   * also the safe choice from a tenancy standpoint: it never reveals whether
   * a differently-scoped PR id exists. It deliberately does NOT fall back to
   * any single-agent run from the PR's unrelated history.
   */
  async latestForPull(workspaceId: string, prId: string): Promise<MultiAgentRunView | null> {
    const found = await this.repo.latestForPull(workspaceId, prId);
    if (!found) return null;

    const { run, members } = found;

    const attributedFindings: AttributedFinding[] = [];
    for (const member of members) {
      const key = memberKey(member);
      for (const row of member.findings) {
        attributedFindings.push({ finding: toFinding(row), agentId: key, runId: member.runId });
      }
    }

    const groups = groupByLocation(attributedFindings);
    const cellMembers = members.map((m) => ({ agentId: memberKey(m), status: m.status }));
    const status = deriveStatus(members.map((m) => ({ status: m.status })));

    return {
      id: run.id,
      pr_id: run.prId,
      ran_at: run.ranAt.toISOString(),
      status,
      members: members.map(toMemberDto),
      groups: groups.map((g) => toGroupDto(g, cellMembers)),
    };
  }

  /**
   * A pointer to the newest multi-agent run in a repo, or `null` when the
   * repo has none. Backs the global "Multi-Agent Review" nav entry, which
   * shows the Configure screen only when there is nothing to show yet.
   *
   * Like `latestForPull`, a repo in another workspace and a repo with no runs
   * are indistinguishable here — both are `null`, so this never reveals
   * whether a differently-scoped repo id exists.
   */
  async latestForRepo(
    workspaceId: string,
    repoId: string,
  ): Promise<MultiAgentLatestRunPointer | null> {
    const found = await this.repo.latestForRepo(workspaceId, repoId);
    return found ? { id: found.id, pr_id: found.prId } : null;
  }

  /**
   * Per-agent duration/cost estimates for the multi-agent "select agents,
   * see estimate" picker (SPEC-05, T-14 — AC-9, AC-10, AC-11, AC-12).
   *
   * `agentIds` is the caller's current selection; when omitted, every agent
   * in the workspace is estimated (so the picker can render a row for each
   * one before any selection is made). Every requested/workspace agent gets
   * an entry — including the no-history case, which maps to
   * `{ duration_ms: null, cost_usd: null }` (never `0`, see `estimate.ts`) so
   * the UI can render "no history yet" rather than silently omitting the
   * row. Totals (AC-10) are computed client-side from this array and are
   * NOT part of this method.
   *
   * Zero model calls (AC-12): this method only reads `agent_runs` rows
   * through `repo.doneRunsForEstimate` and (when `agentIds` is omitted)
   * `container.agentsRepo.list` — no LLM adapter is ever touched here.
   */
  async estimates(workspaceId: string, agentIds?: string[]): Promise<AgentEstimate[]> {
    const ids = agentIds ?? (await this.container.agentsRepo.list(workspaceId)).map((a) => a.id);

    const rowsByAgent = await this.repo.doneRunsForEstimate(workspaceId, ids);

    return ids.map((agentId) => toEstimateDto(agentId, rowsByAgent.get(agentId) ?? []));
  }
}

// ── Internal helpers (pure mapping only — no I/O) ───────────────────────────

/**
 * The key used to attribute a finding/cell to "this member" throughout
 * grouping/similarity/cells. Normally the agent id; falls back to the
 * member's run id when the agent has been deleted (`agent_runs.agent_id` is
 * `on delete set null`) so a deleted agent's member still gets a stable,
 * unique attribution key instead of colliding with every other deleted
 * agent's member under the empty string.
 */
function memberKey(member: { agentId: string | null; runId: string }): string {
  return member.agentId ?? member.runId;
}

/** Map a persisted `findings` row (camelCase) to the domain `Finding` shape. */
function toFinding(row: FindingRow): Finding {
  return {
    id: row.id,
    severity: row.severity as Finding['severity'],
    category: row.category as Finding['category'],
    title: row.title,
    file: row.file,
    start_line: row.startLine,
    end_line: row.endLine,
    rationale: row.rationale,
    suggestion: row.suggestion ?? null,
    confidence: row.confidence,
    kind: (row.kind as Finding['kind']) ?? 'finding',
    trifecta_components: (row.trifectaComponents as Finding['trifecta_components']) ?? null,
    evidence: null,
  };
}

/**
 * Map one agent's estimate-source rows (repository's `EstimateSourceRow[]`,
 * camelCase) to the wire `AgentEstimate` shape via the pure `estimateForAgent`
 * (T-07) — never returns the raw Drizzle row shape directly.
 */
function toEstimateDto(
  agentId: string,
  rows: { durationMs: number | null; costUsd: number | null }[],
): AgentEstimate {
  const estimate = estimateForAgent(
    rows.map((r) => ({ duration_ms: r.durationMs, cost_usd: r.costUsd })),
  );
  return { agent_id: agentId, duration_ms: estimate.duration_ms, cost_usd: estimate.cost_usd };
}

/** Map a persisted `findings` row to the wire `FindingRecord` shape (adds review linkage). */
function toFindingRecord(row: FindingRow): FindingRecord {
  return {
    ...toFinding(row),
    review_id: row.reviewId,
    accepted_at: row.acceptedAt?.toISOString() ?? null,
    dismissed_at: row.dismissedAt?.toISOString() ?? null,
  };
}

/** Map one repository member row to the wire `MultiAgentMember` shape. */
function toMemberDto(member: MemberRunRow): MultiAgentMember {
  return {
    agent_id: member.agentId,
    agent_name: member.agentName,
    status: member.status,
    score: member.review?.score ?? null,
    duration_ms: member.durationMs,
    cost_usd: member.costUsd,
    error: member.error,
    run_id: member.runId,
    findings: member.findings.map(toFindingRecord),
  };
}

/** Map one pure `Cell` to the wire `MultiAgentCell` shape (snake_case `agent_id`). */
function toCellDto(cell: Cell): MultiAgentCell {
  switch (cell.state) {
    case 'severity':
      return { state: 'severity', agent_id: cell.agentId, severity: cell.severity };
    case 'did_not_flag':
      return { state: 'did_not_flag', agent_id: cell.agentId };
    case 'failed':
      return { state: 'failed', agent_id: cell.agentId };
    case 'pending':
      return { state: 'pending', agent_id: cell.agentId };
  }
}

/**
 * A group's display `label`: the shortest finding title in the group,
 * first-occurrence-wins on a tie (the group's `findings` array is already
 * deterministically sorted by `groupByLocation`, so "first occurrence" is
 * well-defined). A display convenience only — no AC depends on the exact
 * pick, so this never invents a synthesised label or calls a model.
 */
function pickLabel(findings: AttributedFinding[]): string {
  let label = findings[0]!.finding.title;
  for (const af of findings) {
    if (af.finding.title.length < label.length) label = af.finding.title;
  }
  return label;
}

/** Map one pure `LocationGroup` to the wire `MultiAgentGroup` shape. */
function toGroupDto(
  group: LocationGroup,
  cellMembers: { agentId: string; status: string | null }[],
): MultiAgentGroup {
  const findings: MultiAgentGroupFinding[] = group.findings.map((af) => ({
    ...af.finding,
    agent_id: af.agentId,
  }));

  return {
    file: group.file,
    start_line: group.minStartLine,
    end_line: group.minEndLine,
    label: pickLabel(group.findings),
    findings,
    cells: buildCells(group, cellMembers).map(toCellDto),
    matched: isMatched(group),
    divergent: isDivergent(group),
    agreed: isAgreed(group),
  };
}
