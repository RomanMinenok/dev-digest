/**
 * Case types + the runners that turn a data array into vitest tests. This module owns the ONE
 * true measure → (log) → assert body, so case authors never rewrite it — which is exactly what
 * keeps the "assert before record" bug from recurring once record() lands (T2 slots into the
 * marked spot below, in this one file).
 */

import { test, expect } from "vitest";
import { DEFAULT_THRESHOLD, WORKFLOW_DISALLOWED_TOOLS } from "../config.js";
import { skillTask, agentTask, workflowTask } from "../tasks.js";
import { runClaude, type Result, type RunOptions } from "../runtime/run-claude.js";
import { patternMatch } from "../scoring/pattern-match.js";
import { llmJudge, type Verdict } from "../scoring/llm-judge.js";
import { logTrace, logVerdict } from "../logging/log.js";
import { record } from "../records/record.js";

// --- Case shapes ------------------------------------------------------------

/** A judge-and-grounding case. Same shape for skills and agents; only the task differs. */
export interface QualityCase {
  name: string;
  kind?: "quality" | "grounding";
  prompt: string;
  /** Practices the judge scores (quality). Omit for a pure grounding case. */
  practices?: string[];
  /** Substrings that must ALL appear before the judge runs (cheap-tier gate). */
  grounding?: string[];
  /** Judge score gate (default 0.6). */
  threshold?: number;
  maxTurns?: number;
}
export type SkillCase = QualityCase;
export type AgentCase = QualityCase;

/** A trace-asserted workflow case — a discriminated union routed by `kind`. */
export type WorkflowCase =
  | {
      kind: "dispatch";
      name: string;
      prompt: string;
      expectSubagent: string;
      /** Default true (subagent must be launched). Set false for a near-miss: it must NOT launch. */
      shouldDispatch?: boolean;
      maxTurns?: number;
    }
  | {
      kind: "activation";
      name: string;
      prompt: string;
      skill: string;
      shouldActivate: boolean;
      maxTurns?: number;
    }
  | {
      kind: "contrast";
      name: string;
      prompt: string;
      expectFileRead: string;
      /**
       * The map's edge, in tool calls. With CLAUDE.md the target doc is reached almost
       * immediately (root map → package CLAUDE.md → the doc); without it the model must search
       * the tree first. So treatment must hit the file WITHIN this many tool calls, and control
       * must not — which is a claim about routing, unlike the old control (an empty tmpdir where
       * the file did not exist, so "control never read it" was true by construction).
       */
      withinToolCalls?: number;
      tools?: string[];
      maxTurns?: number;
    }
  | {
      // A single-session composite: run ONE workflowTask and assert several trace facets at once.
      // Cheaper than separate dispatch/activation/contrast cases (one session, not N) at the cost
      // of coarser diagnostics and no control run — use contrast when you must isolate CLAUDE.md's
      // contribution. Every provided expectation must hold; omitted fields are not checked.
      kind: "trace";
      name: string;
      prompt: string;
      expectSubagents?: string[];
      expectSkills?: string[];
      expectFilesRead?: string[];
      /** Files the session must NOT read — wrong-module routing, free on the same session. */
      expectFilesNotRead?: string[];
      /** Subagents that must NOT be launched, e.g. "it answered inline instead of delegating". */
      expectNoSubagents?: string[];
      /**
       * Substrings the ANSWER must contain (all of them). Trace asserts prove the model opened the
       * doc; this proves it used what was inside. Deterministic, no judge, no extra session.
       */
      expectText?: string[];
      /** Tools the session must NOT call — e.g. Write/Edit for the "ask before implementing" rule. */
      expectNoTools?: string[];
      maxTurns?: number;
    };

/** Index of the first tool call that read `file`; -1 if never. Ordering is what contrast grades. */
const firstReadAt = (result: Result, file: string): number =>
  result.toolLog.findIndex((t) => t.file?.includes(file));

/** Did a skill engage? Either an explicit Skill tool-call, or reading its SKILL.md. */
export function activated(result: Result, skill: string): boolean {
  const bySkill = result.skillsInvoked.some((s) => s === skill || s.endsWith(`:${skill}`));
  const byRead = result.filesRead.some((f) => f.includes(`skills/${skill}/SKILL.md`));
  return bySkill || byRead;
}

// --- Runners ----------------------------------------------------------------

type Task = (prompt: string, artifact: string, opts?: RunOptions) => Promise<Result>;

function runQualityCases(artifact: string, cases: QualityCase[], task: Task): void {
  for (const c of cases) {
    test(c.name, async () => {
      const threshold = c.threshold ?? DEFAULT_THRESHOLD;
      const result = await task(c.prompt, artifact, { maxTurns: c.maxTurns });
      logTrace(c.name, result);

      // measure → record → assert. Everything measurable runs in the try; record() fires in the
      // finally with whatever accumulated; the asserts happen strictly after. A failing config
      // (e.g. baseline: grounding gate fails, judge skipped) still leaves a record.
      let grounded: number | undefined;
      let verdict: Verdict | undefined;
      try {
        // Cheap deterministic tier first — the grounding gate. When it fails the judge is skipped.
        if (c.grounding?.length) grounded = patternMatch(result.text, c.grounding);
        if (c.practices?.length && (grounded === undefined || grounded === 1)) {
          verdict = await llmJudge(result.text, c.practices);
          logVerdict(c.name, verdict);
        }
      } finally {
        record(c.name, { result, verdict, grounded, threshold });
      }

      if (grounded !== undefined) {
        expect(grounded, `missing concrete evidence; output:\n${result.text}`).toBe(1);
      }
      if (verdict) {
        expect(verdict.score, JSON.stringify(verdict.results)).toBeGreaterThanOrEqual(threshold);
      }
    });
  }
}

export const runSkillCases = (skill: string, cases: SkillCase[]) => runQualityCases(skill, cases, skillTask);
export const runAgentCases = (agent: string, cases: AgentCase[]) => runQualityCases(agent, cases, agentTask);

/**
 * Collects every failed expectation of one case instead of throwing at the first, so the case can
 * (a) record its OWN pass/fail — `!isError` was never the question a workflow case asks — and
 * (b) report all the ways a run missed, not just the earliest.
 */
class Checks {
  private failures: string[] = [];
  ok(condition: boolean, whyItFailed: string): void {
    if (!condition) this.failures.push(whyItFailed);
  }
  get passed(): boolean {
    return this.failures.length === 0;
  }
  assert(): void {
    expect(this.failures.join("\n"), "expectations not met").toBe("");
  }
}

/**
 * An absence ("did NOT dispatch", "did NOT activate") only means restraint if the session ended on
 * its own. A run cut off at the turn cap proves nothing — it might have dispatched on the next
 * turn — yet it used to be scored as a pass. Negative cases therefore also require a clean end.
 */
const completed = (c: Checks, result: Result): void =>
  c.ok(
    !result.isError,
    `session did not finish (turn cap or error) — an absence in a truncated run is not evidence; ` +
      `turns: ${result.numTurns}, tools: ${result.toolsUsed.join(", ")}`,
  );

export function runWorkflowCases(cases: WorkflowCase[]): void {
  for (const c of cases) {
    test(c.name, async () => {
      const checks = new Checks();

      if (c.kind === "dispatch") {
        const expect1 = c.expectSubagent;
        const shouldDispatch = c.shouldDispatch ?? true;
        // Positive: stop the moment the subagent is launched — no need to wait out its nested
        // session. Negative (near-miss): no early stop signal exists, so it runs to completion.
        const result = await workflowTask(c.prompt, {
          maxTurns: c.maxTurns,
          ...(shouldDispatch ? { stopWhen: (p) => p.subagents.includes(expect1) } : {}),
        });
        logTrace(c.name, result);
        try {
          const dispatched = result.subagents.includes(expect1);
          checks.ok(
            dispatched === shouldDispatch,
            `expected ${expect1} ${shouldDispatch ? "" : "NOT "}to be dispatched | subagents: ${result.subagents.join(", ") || "none"}`,
          );
          if (!shouldDispatch) completed(checks, result);
        } finally {
          record(c.name, { result, passed: checks.passed });
        }
      } else if (c.kind === "activation") {
        const result = await workflowTask(c.prompt, { maxTurns: c.maxTurns });
        logTrace(c.name, result);
        try {
          checks.ok(
            activated(result, c.skill) === c.shouldActivate,
            `expected ${c.skill} ${c.shouldActivate ? "" : "NOT "}to engage | skills: ${result.skillsInvoked.join(", ") || "none"} | reads: ${result.filesRead.join(", ")}`,
          );
          if (!c.shouldActivate) completed(checks, result);
        } finally {
          record(c.name, { result, passed: checks.passed });
        }
      } else if (c.kind === "trace") {
        // One session, many asserts — every provided expectation is checked against the same trace.
        // Stop as soon as ALL POSITIVE expectations are satisfied (doc read + subagent launched), so
        // a dispatch-bearing trace doesn't pay for the nested subagent's full run. Negative
        // expectations (must-not-read / must-not-call) are graded on whatever the session did up to
        // that point — which is sound: they can only be violated by something that already happened.
        const subs = c.expectSubagents ?? [];
        const skls = c.expectSkills ?? [];
        const files = c.expectFilesRead ?? [];
        const needsText = (c.expectText?.length ?? 0) > 0;
        const skillEngaged = (p: { skillsInvoked: string[]; filesRead: string[] }, skill: string) =>
          p.skillsInvoked.some((s) => s === skill || s.endsWith(`:${skill}`)) ||
          p.filesRead.some((f) => f.includes(`skills/${skill}/SKILL.md`));
        const result = await workflowTask(c.prompt, {
          maxTurns: c.maxTurns,
          // An expectText case must run to its final answer — stopping at the last tool call would
          // cut off the very prose it grades.
          ...(needsText
            ? {}
            : {
                stopWhen: (p) =>
                  subs.every((s) => p.subagents.includes(s)) &&
                  skls.every((s) => skillEngaged(p, s)) &&
                  files.every((f) => p.filesRead.some((r) => r.includes(f))),
              }),
        });
        logTrace(c.name, result);

        let grounded: number | undefined;
        try {
          for (const sub of subs) {
            checks.ok(
              result.subagents.includes(sub),
              `${sub} not dispatched | subagents: ${result.subagents.join(", ") || "none"}`,
            );
          }
          for (const sub of c.expectNoSubagents ?? []) {
            checks.ok(!result.subagents.includes(sub), `${sub} was dispatched but must not be`);
          }
          for (const skill of skls) {
            checks.ok(
              activated(result, skill),
              `skill ${skill} not engaged | skills: ${result.skillsInvoked.join(", ") || "none"} | reads: ${result.filesRead.join(", ")}`,
            );
          }
          for (const file of files) {
            checks.ok(
              result.filesRead.some((f) => f.includes(file)),
              `${file} not read | reads: ${result.filesRead.join(", ") || "none"}`,
            );
          }
          for (const file of c.expectFilesNotRead ?? []) {
            checks.ok(
              !result.filesRead.some((f) => f.includes(file)),
              `${file} was read but must not be (wrong-module routing) | reads: ${result.filesRead.join(", ")}`,
            );
          }
          for (const tool of c.expectNoTools ?? []) {
            checks.ok(!result.toolsUsed.includes(tool), `${tool} was called but must not be`);
          }
          if (c.expectText?.length) {
            grounded = patternMatch(result.text, c.expectText);
            checks.ok(
              grounded === 1,
              `answer is missing required content (${c.expectText.join(", ")}) — the doc was opened but not used;\noutput:\n${result.text}`,
            );
          }
        } finally {
          record(c.name, { result, grounded, passed: checks.passed });
        }
      } else {
        // contrast: SAME repo, SAME tools, SAME turn budget — the only difference is whether the
        // on-disk harness (CLAUDE.md) is loaded. The old control ran in an empty tmpdir, where the
        // expected file did not exist, so "control never read it" was true by construction and the
        // case proved nothing. Here the control can reach the file — it just has no map, so it must
        // search for it, and the assertion is about HOW FAST each side gets there.
        const tools = c.tools ?? ["Read", "Grep", "Glob"];
        const budget = c.withinToolCalls ?? 3;
        const treatment = await workflowTask(c.prompt, { allowedTools: tools, maxTurns: c.maxTurns });
        const control = await runClaude(c.prompt, {
          allowedTools: tools,
          disallowedTools: WORKFLOW_DISALLOWED_TOOLS,
          maxTurns: c.maxTurns,
          settingSources: [], // no CLAUDE.md, no skills, no hooks — the repo tree, unlabelled
        });
        logTrace(`${c.name} [treatment]`, treatment);
        logTrace(`${c.name} [control]`, control);
        try {
          const tAt = firstReadAt(treatment, c.expectFileRead);
          const cAt = firstReadAt(control, c.expectFileRead);
          checks.ok(
            tAt >= 0 && tAt < budget,
            `treatment should reach ${c.expectFileRead} within ${budget} tool calls, ` +
              `got ${tAt < 0 ? "never" : `call #${tAt + 1}`} | reads: ${treatment.filesRead.join(", ") || "none"}`,
          );
          checks.ok(
            cAt < 0 || cAt >= budget,
            `control reached ${c.expectFileRead} at call #${cAt + 1} without the harness — ` +
              `CLAUDE.md is not what routed the treatment there`,
          );
        } finally {
          record(`${c.name} [treatment]`, { result: treatment, passed: checks.passed });
          record(`${c.name} [control]`, { result: control, passed: checks.passed });
        }
      }

      checks.assert();
    });
  }
}
