import type {
  EvalCase,
  EvalCaseWithLatestRun,
  EvalDashboard,
  EvalRunRecord,
  EvalRunResult,
  EvalTrendPoint,
  RunTrace,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { BadRequestError, NotFoundError } from '../../platform/errors.js';
import { parseUnifiedDiff } from '../../adapters/git/diff-parser.js';
import { rankNoteSentence } from '../reviews/helpers.js';
import { buildEnrichment } from './capture.js';
import type { UpdateCaseInput } from './repository.js';
import { runCase } from './runner.js';
import { aggregateRunRows } from './scorer.js';
import type { EvalCaseRow, EvalEnrichment, EvalInputMeta, EvalRunRow } from './types.js';

/**
 * Application-layer service for eval case CRUD (SPEC-03, T10).
 *
 * Ownership rules (AC-6):
 * - `owner_kind` is always forced to `'agent'`; `owner_id` is always the
 *   route-level `agentId` — never taken from the body.
 * - No `repo_id` concept exists in this module.
 *
 * T11 hook: `create` is structured so that T11 can add `captureEnrichment`
 * called when `input_meta.source` is present. Hand-written cases (no source)
 * pass `input_meta` through unchanged.
 */

// ── Service-layer input shapes ──────────────────────────────────────────────

/** Body accepted by `EvalService.create`. */
export interface CreateEvalCaseBody {
  name: string;
  /**
   * Raw git diff string. Required and non-empty — an eval case without a diff
   * has nothing to run the agent against.
   */
  input_diff?: string;
  input_files?: unknown;
  /**
   * Opaque metadata for the case. When it carries a `source` block
   * (see `EvalInputMeta` in `./types.ts`), T11 will intercept it and attach
   * enrichment from the source review run before persisting.
   */
  input_meta?: unknown;
  expected_output?: unknown;
  notes?: string | null;
}

/** Body accepted by `EvalService.update`. */
export interface UpdateEvalCaseBody {
  name?: string;
  /** Pass `null` to clear the stored diff. */
  input_diff?: string | null;
  input_files?: unknown;
  input_meta?: unknown;
  expected_output?: unknown;
  notes?: string | null;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Map a persisted `eval_cases` row (camelCase Drizzle keys) to the public
 * `EvalCase` contract (snake_case). Single source of truth for the
 * row → DTO conversion; must be applied before any response leaves the
 * service so all callers (list / create / update) agree on the shape.
 */
function toEvalCaseDto(row: EvalCaseRow): EvalCase {
  return {
    id: row.id,
    owner_kind: row.ownerKind as EvalCase['owner_kind'],
    owner_id: row.ownerId,
    name: row.name,
    input_diff: row.inputDiff ?? '',
    input_files: row.inputFiles ?? null,
    input_meta: row.inputMeta ?? null,
    expected_output: row.expectedOutput ?? null,
    notes: row.notes,
  };
}

/**
 * Maps a persisted run row to the wire shape. `fallbackVersion` covers rows
 * written before `agent_version` existed (the column is nullable).
 */
function toEvalRunRecord(row: EvalRunRow, fallbackVersion: number): EvalRunRecord {
  return {
    id: row.id,
    case_id: row.caseId,
    case_name: null,
    ran_at: row.ranAt.toISOString(),
    actual_output: row.actualOutput,
    pass: row.pass,
    recall: row.recall,
    precision: row.precision,
    citation_accuracy: row.citationAccuracy,
    duration_ms: row.durationMs,
    cost_usd: row.costUsd,
    agent_version: row.agentVersion ?? fallbackVersion,
  };
}

/**
 * Given a list of `EvalRunRow` ordered newest-first by `ranAt`, returns only
 * the first (latest) row per `caseId`. This is the canonical "latest run per
 * case within one agent version" definition — never "the newest N runs".
 */
function deduplicateLatestPerCase(rows: EvalRunRow[]): EvalRunRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.caseId)) return false;
    seen.add(r.caseId);
    return true;
  });
}

/**
 * Returns true when `meta` is an object that carries a non-null `source` block
 * (indicating an eval case seeded from a real review run). Hand-written cases
 * have no `source` and return false.
 */
function isMetaWithSource(meta: unknown): meta is EvalInputMeta {
  if (typeof meta !== 'object' || meta === null) return false;
  const src = (meta as Record<string, unknown>).source;
  return (
    typeof src === 'object' &&
    src !== null &&
    typeof (src as Record<string, unknown>).run_id === 'string' &&
    typeof (src as Record<string, unknown>).pr_id === 'string'
  );
}

// ── Service ─────────────────────────────────────────────────────────────────

export class EvalService {
  constructor(private container: Container) {}

  /**
   * All eval cases for the given agent in the workspace.
   * Returns a flat `EvalCase[]` (snake_case contract) — latest-run data is
   * derived by the client from the dashboard's `recent_runs` list, so no
   * extra `latestRunPerCase` query is needed here.
   */
  /**
   * The agent's cases, each with its most recent run (AC-33/34).
   *
   * `latestRunPerCase` spans EVERY agent version and is not truncated, so a
   * case's pass/fail state here is always its real one. The dashboard's
   * `recent_runs` is capped and version-scoped and must never be used for this.
   */
  async list(workspaceId: string, agentId: string): Promise<EvalCaseWithLatestRun[]> {
    const cases = await this.container.evalRepo.listCasesForOwner(
      workspaceId,
      'agent',
      agentId,
    );
    if (cases.length === 0) return [];

    const agent = await this.container.agentsRepo.getById(workspaceId, agentId);
    const latestRuns = await this.container.evalRepo.latestRunPerCase(
      cases.map((c) => c.id),
    );
    const latestByCase = new Map(latestRuns.map((r) => [r.caseId, r]));

    return cases.map((c) => {
      const run = latestByCase.get(c.id);
      return {
        ...toEvalCaseDto(c),
        latest_run: run ? toEvalRunRecord(run, agent?.version ?? 1) : null,
      };
    });
  }

  /**
   * Create a new eval case for the given agent.
   *
   * AC-6: `owner_kind` is forced to `'agent'`; `owner_id` is forced to
   * `agentId` — the body's ownership fields are ignored.
   *
   * Throws `NotFoundError` (404) when `agentId` is not a known agent in
   * this workspace, and `BadRequestError` (400) when `input_diff` is absent
   * or empty.
   *
   * When `body.input_meta` carries a `source` block, the private
   * `captureEnrichment` method populates the frozen enrichment from the
   * originating review run before persisting. Hand-written cases (no `source`)
   * store `input_meta` as-is with no enrichment.
   */
  async create(
    workspaceId: string,
    agentId: string,
    body: CreateEvalCaseBody,
  ): Promise<EvalCase> {
    const agent = await this.container.agentsRepo.getById(workspaceId, agentId);
    if (!agent) throw new NotFoundError('Agent not found');

    const inputDiff = body.input_diff ?? '';
    if (inputDiff.trim() === '') {
      throw new BadRequestError('input_diff is required and must not be empty');
    }

    // T11: when input_meta carries a source block, freeze enrichment from the
    // originating review run. Hand-written cases (no source) store input_meta
    // as-is and receive no enrichment.
    const rawMeta = body.input_meta;
    let inputMeta: unknown = rawMeta ?? null;

    if (isMetaWithSource(rawMeta)) {
      inputMeta = await this.captureEnrichment(workspaceId, inputDiff, rawMeta);
    }

    const row = await this.container.evalRepo.createCase({
      workspaceId,
      ownerKind: 'agent',
      ownerId: agentId,
      name: body.name,
      inputDiff,
      inputFiles: body.input_files ?? null,
      inputMeta,
      expectedOutput: body.expected_output ?? null,
      notes: body.notes ?? null,
    });
    return toEvalCaseDto(row);
  }

  /**
   * Patch mutable fields of an existing eval case (workspace-scoped).
   * Only keys present in `body` are updated; absent keys are left unchanged.
   * Returns `null` when the case does not exist in this workspace.
   */
  async update(
    workspaceId: string,
    caseId: string,
    body: UpdateEvalCaseBody,
  ): Promise<EvalCase | null> {
    const input: UpdateCaseInput = {};
    if (body.name !== undefined) input.name = body.name;
    if ('input_diff' in body) input.inputDiff = body.input_diff ?? null;
    if ('input_files' in body) input.inputFiles = body.input_files;
    if ('input_meta' in body) input.inputMeta = body.input_meta;
    if ('expected_output' in body) input.expectedOutput = body.expected_output;
    if ('notes' in body) input.notes = body.notes ?? null;

    const row = await this.container.evalRepo.updateCase(workspaceId, caseId, input);
    return row ? toEvalCaseDto(row) : null;
  }

  /**
   * Delete an eval case and all its runs (the DB FK carries `onDelete:
   * 'cascade'`, so run rows are removed automatically). No-op when the case
   * does not exist in this workspace.
   */
  async delete(workspaceId: string, caseId: string): Promise<void> {
    return this.container.evalRepo.deleteCase(workspaceId, caseId);
  }

  /**
   * Run one or more eval cases for a given agent, sequentially.
   *
   * AC-17: one model call at a time — plain `for` loop, strictly sequential.
   * AC-18: a case failure persists an `eval_runs` row with `pass = false` and
   *        the error message as `actual_output`, then continues to the next
   *        case rather than aborting the set.
   *
   * @param workspaceId - Workspace scope.
   * @param agentId     - The agent to evaluate (404 when not found).
   * @param caseIds     - Subset of case IDs to run. When absent, ALL cases
   *                      for this agent are run. Zero cases → returns `[]`
   *                      with no model calls and no DB writes.
   */
  async runCases(
    workspaceId: string,
    agentId: string,
    caseIds?: string[],
  ): Promise<EvalRunResult[]> {
    const agent = await this.container.agentsRepo.getById(workspaceId, agentId);
    if (!agent) throw new NotFoundError('Agent not found');

    // Load candidate cases — all of the agent's cases, then filter when a
    // subset was requested.
    const allCases = await this.container.evalRepo.listCasesForOwner(
      workspaceId,
      'agent',
      agentId,
    );
    const cases: EvalCaseRow[] =
      caseIds !== undefined
        ? allCases.filter((c) => caseIds.includes(c.id))
        : allCases;

    if (cases.length === 0) return [];

    const results: EvalRunResult[] = [];

    // AC-17: sequential — one model call at a time.
    for (const evalCase of cases) {
      try {
        const result = await runCase(this.container, agent, evalCase);
        results.push(result);
      } catch (err) {
        // AC-18: persist a failure row and continue to the next case.
        const message = err instanceof Error ? err.message : String(err);
        const row = await this.container.evalRepo.insertRun(evalCase.id, {
          agentVersion: agent.version,
          pass: false,
          recall: null,
          precision: null,
          citationAccuracy: null,
          durationMs: null,
          costUsd: null,
          actualOutput: message,
        });
        results.push({
          run_id: row.id,
          case_id: evalCase.id,
          result: {
            recall: 0,
            precision: 0,
            citation_accuracy: 0,
            traces_passed: 0,
            traces_total: 0,
            duration_ms: 0,
            cost_usd: null,
            per_trace: [
              {
                name: evalCase.name,
                pass: false,
                expected: [],
                actual: [],
              },
            ],
          },
        });
      }
    }

    return results;
  }

  /**
   * Aggregate eval dashboard for a single agent.
   *
   * `current` = aggregate over the **latest run per case** at the agent's
   * current `version` (Insight: "latest run per case within one agent version",
   * never "the newest N runs across all cases").
   *
   * `delta` = `current` minus the aggregate for the newest *previous* agent
   * version that has any runs. When no previous version with runs exists,
   * deltas are `0` (the client decides not to render them — AC-32).
   *
   * Zero-cases edge case: returns `cases_total: 0`, all metrics `0` (reported
   * as unavailable, not `1`/`100%`).
   */
  async dashboard(workspaceId: string, agentId: string): Promise<EvalDashboard> {
    const agent = await this.container.agentsRepo.getById(workspaceId, agentId);
    if (!agent) throw new NotFoundError('Agent not found');

    const currentVersion = agent.version;

    const cases = await this.container.evalRepo.listCasesForOwner(
      workspaceId,
      'agent',
      agentId,
    );
    const caseIds = cases.map((c) => c.id);

    // Zero-case edge case: metrics reported as unavailable (0), not 1/100%.
    if (caseIds.length === 0) {
      return {
        owner_kind: 'agent',
        owner_id: agentId,
        cases_total: 0,
        current: {
          recall: 0,
          precision: 0,
          citation_accuracy: 0,
          traces_passed: 0,
          traces_total: 0,
          cost_usd: null,
        },
        delta: { recall: 0, precision: 0, citation_accuracy: 0 },
        trend: [],
        recent_runs: [],
        alert: null,
      };
    }

    // Runs for current version — all runs (multiple per case across repeat
    // executions), ordered newest-first by ran_at.
    const currentVersionRuns = await this.container.evalRepo.runsForAgentVersion(
      caseIds,
      currentVersion,
    );

    // Latest run per case for current version (first occurrence per caseId
    // is the newest because runsForAgentVersion orders desc by ran_at).
    const latestCurrentRuns = deduplicateLatestPerCase(currentVersionRuns);

    const current = aggregateRunRows(latestCurrentRuns);

    // Delta: find the newest previous version that has any runs.
    const versions =
      await this.container.evalRepo.distinctAgentVersionsWithRuns(caseIds);
    const prevVersion = versions.filter((v) => v < currentVersion).at(-1);

    let delta = { recall: 0, precision: 0, citation_accuracy: 0 };
    let prevVersionRuns: EvalRunRow[] = [];
    if (prevVersion !== undefined) {
      prevVersionRuns = await this.container.evalRepo.runsForAgentVersion(
        caseIds,
        prevVersion,
      );
      const latestPrevRuns = deduplicateLatestPerCase(prevVersionRuns);
      const prevAgg = aggregateRunRows(latestPrevRuns);
      delta = {
        recall: current.recall - prevAgg.recall,
        precision: current.precision - prevAgg.precision,
        citation_accuracy: current.citation_accuracy - prevAgg.citation_accuracy,
      };
    }

    // Trend: all runs for the current version in chronological order (oldest
    // first). Each point maps one run row's stored metrics directly.
    const trend: EvalTrendPoint[] = [...currentVersionRuns].reverse().map((r) => ({
      ran_at: r.ranAt.toISOString(),
      recall: r.recall ?? 0,
      precision: r.precision ?? 0,
      citation_accuracy: r.citationAccuracy ?? 0,
      pass_rate: r.pass === true ? 1 : 0,
      cost_usd: r.costUsd,
    }));

    // Recent runs: up to 20 most recent runs across current AND previous
    // version. Including previous-version entries lets the client detect
    // hasPreviousVersion to gate delta display (AC-32: no delta shown when
    // no previous version has runs). The client derives latestRunByCase from
    // this list by picking the most recent per case_id — current-version rows
    // sort first (they are more recent), so pass/fail status is still correct.
    const allRunsForDisplay = [...currentVersionRuns, ...prevVersionRuns].sort(
      (a, b) => b.ranAt.getTime() - a.ranAt.getTime(),
    );
    const recentRunRows = allRunsForDisplay.slice(0, 20);
    const recent_runs = recentRunRows.map((r) => toEvalRunRecord(r, currentVersion));

    return {
      owner_kind: 'agent',
      owner_id: agentId,
      cases_total: cases.length,
      current,
      delta,
      trend,
      recent_runs,
      alert: null,
    };
  }

  /**
   * Populate the frozen enrichment block on `meta` from the originating review
   * run. All I/O here degrades gracefully — a failed fetch yields an empty
   * enrichment rather than a thrown error.
   *
   * AC-15: `context_docs` come from `trace.specs_read` (handled in
   * `buildEnrichment`).
   *
   * NEVER calls `container.git` or parses rendered prompt text.
   */
  private async captureEnrichment(
    workspaceId: string,
    inputDiff: string,
    meta: EvalInputMeta,
  ): Promise<EvalInputMeta> {
    const { source } = meta;

    // Step 1: originating run trace — absent or error → empty enrichment.
    let trace: RunTrace | undefined;
    try {
      trace = await this.container.reviewRepo.getRunTrace(source.run_id);
    } catch {
      trace = undefined;
    }

    // Step 2: structured stored-intent for the PR. Never pass
    // trace.prompt_assembly.intent (that is the already-rendered section).
    let intent: EvalEnrichment['intent'] = null;
    try {
      const row = await this.container.intentRepo.get(source.pr_id);
      if (row) {
        intent = {
          intent: row.intent,
          in_scope: row.inScope,
          out_of_scope: row.outOfScope,
        };
      }
    } catch {
      intent = null;
    }

    // Step 3: recompute the rank note from the case's own input_diff.
    // Resolve repo_id from pull_requests, then rank changed files.
    // Degrades to '' on unindexed repo, missing PR, empty diff, or any error.
    let rankNote = '';
    try {
      const pull = await this.container.reviewRepo.getPull(workspaceId, source.pr_id);
      if (pull) {
        const diff = parseUnifiedDiff(inputDiff);
        const changedFiles = diff.files.map((f) => f.path);
        if (changedFiles.length > 0) {
          const ranks = await this.container.repoIntel.getFileRank(pull.repoId, changedFiles);
          if (ranks.length > 0) {
            const hot = ranks.filter((r) => r.percentile >= 95);
            if (hot.length > 0) {
              rankNote = rankNoteSentence(hot.length, changedFiles.length);
            }
          }
        }
      }
    } catch {
      rankNote = '';
    }

    // Step 4: build the frozen block and write it into input_meta.enrichment.
    const enrichment = buildEnrichment({ trace, intent, rankNote });
    return { ...meta, enrichment };
  }
}
