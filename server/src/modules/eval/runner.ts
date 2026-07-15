/**
 * eval/runner.ts — single-case eval runner (T9, SPEC-03).
 *
 * `runCase(container, agent, evalCase)`:
 *   1. Resolve live agent inputs — systemPrompt, llm, model, strategy, skills.
 *   2. Take frozen case inputs via caseToReviewInputs — no filesystem, no git.
 *   3. One reviewPullRequest call.
 *   4. Score with scorer.ts.
 *   5. Persist an eval_runs row; return EvalRunResult.
 *
 * Layer boundaries enforced:
 * - Zero Drizzle / Fastify imports (Application layer, not Infrastructure).
 * - Zero container.git / readFile / checkoutPullHead (AC-16, eval is Postgres + one model call).
 * - expected_output is NEVER read before the model call — only after, for scoring (AC-38).
 */
import { reviewPullRequest } from '@devdigest/reviewer-core';
import type { Provider, EvalRunResult } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import type { AgentRow } from '../../db/rows.js';
import { REVIEW_STRATEGY } from '../reviews/constants.js';
import { caseToReviewInputs } from './prompt-inputs.js';
import { scoreCase, aggregate } from './scorer.js';
import { appendEvalRunLog } from './run-log.js';
import type { EvalCaseRow, EvalEnrichment, EvalInputMeta, ExpectedFinding } from './types.js';

/**
 * Run one eval case against a live agent config, score the result, and persist
 * an `eval_runs` row.
 *
 * @param container - DI root; used for `llm`, `agentsRepo`, `evalRepo`, `priceBook`.
 *                    `container.git` is deliberately NOT used (AC-16).
 * @param agent     - The live Drizzle agent row (systemPrompt, provider, model, …).
 * @param evalCase  - The frozen eval case row from `eval_cases`.
 * @param logFile   - Optional path to a per-sweep run log file. When set (the
 *                    caller decides, gated by `EVAL_RUN_LOG_ENABLED`), the full
 *                    prompt + findings + metrics for this case are appended to
 *                    it. Undefined = no file logging.
 */
export async function runCase(
  container: Container,
  agent: AgentRow,
  evalCase: EvalCaseRow,
  logFile?: string,
): Promise<EvalRunResult> {
  const start = Date.now();

  // ── 1. Live agent inputs ────────────────────────────────────────────────────
  // provider → llm, strategy (fall back to studio default), linked+enabled skills.
  // Identical skill-filter rule to run-executor.ts:203-207 (AC-13).
  const llm = await container.llm(agent.provider as Provider);

  const linked = await container.agentsRepo.linkedSkills(agent.id);
  const skillBodies = linked.filter((l) => l.skill.enabled).map((l) => l.skill.body);

  // ── 2. Frozen case inputs (no filesystem, no git) ───────────────────────────
  // Extract the enrichment block stored at capture time from input_meta.enrichment.
  // A hand-written case (S3) has no source/enrichment block — fall back to the
  // empty-enrichment sentinel so caseToReviewInputs still produces a coherent input.
  const meta = evalCase.inputMeta as EvalInputMeta | null;
  const enrichment: EvalEnrichment = meta?.enrichment ?? {
    callers: null,
    repo_map: null,
    rank_note: '',
    intent: null,
    context_docs: [],
  };

  const frozenInputs = caseToReviewInputs(evalCase, enrichment);

  // ── 3. One model call ───────────────────────────────────────────────────────
  // Spread live config + frozen inputs into reviewPullRequest exactly as
  // run-executor.ts:252-285 does (decision 1 / AC-7: production fidelity by
  // construction). The expected_output field on the case is never accessed here.
  const outcome = await reviewPullRequest({
    systemPrompt: agent.systemPrompt,
    model: agent.model,
    llm,
    strategy: agent.strategy ?? REVIEW_STRATEGY,
    // Linked + enabled skill bodies (trusted instructions, omit-when-empty).
    ...(skillBodies.length ? { skills: skillBodies } : {}),
    // All frozen case inputs (diff, task, callers, repoMap, intent, prDescription, specs).
    ...frozenInputs,
    sessionId: `eval:${evalCase.id}:${agent.id}`,
  });

  if (container.config.evalPromptLogEnabled) {
    console.log(
      `\n[eval] prompt — case "${evalCase.name}" · agent "${agent.name}" (v${agent.version})\n` +
        `--- system ---\n${outcome.assembly.system}\n` +
        `--- user ---\n${outcome.assembly.user}\n`,
    );
  }

  // ── 4. Score ────────────────────────────────────────────────────────────────
  // Parse expected_output as ExpectedFinding[] for scoring only — AFTER the model call.
  // An invalid / absent / non-array value defaults to [] (no expectations ↔ AC-30:
  // pass when nothing is produced).
  const rawExpected = evalCase.expectedOutput;
  const expected: ExpectedFinding[] = Array.isArray(rawExpected)
    ? (rawExpected as ExpectedFinding[])
    : [];

  const produced = outcome.review.findings;
  // kept = post-grounding findings; dropped = candidates the grounding gate removed.
  const kept = produced.length;
  const dropped = outcome.dropped.length;

  const caseScore = scoreCase({ expected, produced, kept, dropped });
  const metrics = aggregate([caseScore]);

  // ── 5. Persist ──────────────────────────────────────────────────────────────
  const durationMs = Date.now() - start;
  // AC-20: always prefer the provider-reported costUsd; fall back to the pricing
  // table estimate only when the provider returns null (same rule as run-executor.ts:287-288).
  const { tokensIn, tokensOut } = outcome;
  const costUsd =
    outcome.costUsd ?? container.priceBook.estimate(agent.model, tokensIn, tokensOut);

  const row = await container.evalRepo.insertRun(evalCase.id, {
    agentVersion: agent.version, // AC-19
    pass: caseScore.pass,
    recall: metrics.recall,
    precision: metrics.precision,
    citationAccuracy: metrics.citation_accuracy,
    durationMs,
    costUsd,
    actualOutput: produced,
    // Raw counts — the dashboard pools these across a run rather than averaging
    // the ratios above (AC-23/25/27). `dropped` is stored nowhere else:
    // `actualOutput` holds only the findings that survived the grounding gate.
    matched: caseScore.matched,
    expectedTotal: caseScore.expectedTotal,
    produced: caseScore.produced,
    falsePositives: caseScore.falsePositives,
    kept: caseScore.kept,
    dropped: caseScore.dropped,
  });

  // ── Optional per-sweep file log (EVAL_RUN_LOG_ENABLED) ──────────────────────
  // Best-effort: a logging failure must never fail the eval run itself.
  if (logFile) {
    try {
      await appendEvalRunLog(logFile, {
        caseName: evalCase.name,
        agentName: agent.name,
        version: agent.version,
        pass: caseScore.pass,
        recall: metrics.recall,
        precision: metrics.precision,
        citationAccuracy: metrics.citation_accuracy,
        costUsd,
        durationMs,
        kept,
        dropped,
        systemPrompt: outcome.assembly.system,
        userPrompt: outcome.assembly.user,
        rawResponse: outcome.raw,
        expected,
        produced,
        droppedFindings: outcome.dropped,
      });
    } catch (err) {
      console.warn(`[eval] run-log write failed for "${evalCase.name}":`, err);
    }
  }

  // ── Return ──────────────────────────────────────────────────────────────────
  return {
    run_id: row.id,
    case_id: evalCase.id,
    result: {
      recall: metrics.recall,
      precision: metrics.precision,
      citation_accuracy: metrics.citation_accuracy,
      traces_passed: metrics.traces_passed,
      traces_total: metrics.traces_total,
      duration_ms: durationMs,
      cost_usd: costUsd,
      per_trace: [
        {
          name: evalCase.name,
          pass: caseScore.pass,
          expected,
          actual: produced,
        },
      ],
    },
  };
}
