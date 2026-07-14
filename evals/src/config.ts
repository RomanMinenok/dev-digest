/**
 * All tunables in one place. No logic here — just the knobs the rest of the package reads.
 * Nothing in this module imports from another src module (it is the bottom of the dependency
 * graph): config knows nothing of runtime, scoring, or the SDK.
 */

// --- Models -----------------------------------------------------------------
// Cheap model under test by default; the judge is a stronger family to soften self-preference.
export const EVAL_MODEL = process.env.EVAL_MODEL ?? "claude-haiku-4-5";
export const EVAL_JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL ?? "claude-sonnet-5";
export const MAX_TURNS = Number(process.env.EVAL_MAX_TURNS ?? "8");

// --- Configuration tag ------------------------------------------------------
// "candidate" = artifact injected (normal). "baseline" = no artifact (benchmark lift baseline).
export const EVAL_CONFIG = process.env.EVAL_CONFIG ?? "candidate";
export const IS_BASELINE = EVAL_CONFIG === "baseline";

// --- Scoring / statistics thresholds ---------------------------------------
export const DEFAULT_THRESHOLD = 0.6; // judge score gate for a quality case
export const FLAKY_LOW = 0.2; // pass rate strictly inside (20%, 80%) is "flaky"
export const FLAKY_HIGH = 0.8;
export const COST_REGRESSION_RATIO = 1.25; // candidate mean tokens > 125% of baseline

// --- Tool allow-lists -------------------------------------------------------
// Subagent-spawning tool name varies by harness; count both.
export const SPAWN_TOOLS = new Set(["Task", "Agent"]);
// workflowTask runs against the LIVE repo with bypassPermissions — keep this read-only.
export const WORKFLOW_ALLOWED_TOOLS = ["Read", "Grep", "Glob", "Task", "Agent", "Skill"];

/**
 * allowedTools does NOT narrow the tool surface — the harness's built-in tools stay reachable
 * whatever we pass. That breaks the evals in two ways, so we name the offenders explicitly:
 *
 *   ReportFindings — a review agent hands its findings to this tool instead of writing prose.
 *     The trace records the call, but the payload never lands in Result.text, so the judge scores
 *     a stub and every agent case fails. Production dispatch gives the agent only its frontmatter
 *     tools (Read/Grep/Glob/Bash), where prose is its ONLY output channel — so blocking this here
 *     restores the contract we actually ship, rather than papering over a bad score.
 *
 *   Write / Edit / NotebookEdit — workflowTask loads the real repo with bypassPermissions, so a
 *     model that decides to "record the insight" edits the developer's actual INSIGHTS.md. Skill
 *     ACTIVATION is what these cases assert; the write itself is never part of the assertion.
 */
export const DISALLOWED_TOOLS = [
  "ReportFindings",
  "Write",
  "Edit",
  "NotebookEdit",
];

/**
 * The workflow tier's box, tighter than DISALLOWED_TOOLS. Its cases assert on WHICH doc the
 * harness sent the model to and WHETHER it dispatched — so every other way of getting information
 * is noise that burns a small model's turn budget and, worse, changes the answer:
 *
 *   Bash — `cat server/README.md` is a read the trace could not see (fixed in run-claude, but a
 *     shell in a bypassPermissions session against the live repo is not worth keeping anyway).
 *   WebSearch / WebFetch — observed: a near-miss case answered a pgvector question off the web
 *     and never touched the harness at all, so the case passed for the wrong reason.
 *   TaskCreate / TaskUpdate — todo bookkeeping, pure turn tax on a 4-turn budget.
 *
 * MCP servers are cut off separately, by strictMcpConfig in run-claude.
 */
export const WORKFLOW_DISALLOWED_TOOLS = [
  ...DISALLOWED_TOOLS,
  "Bash",
  "WebSearch",
  "WebFetch",
  "TaskCreate",
  "TaskUpdate",
];

/**
 * Set in every eval session's env (see runtime/env.ts). The repo's hooks read it and no-op.
 *
 * Why: settingSources:["project"] loads .claude/settings.json — hooks included. The
 * UserPromptSubmit hook injects "read the INSIGHTS.md of the module(s) you touch", naming
 * reviewer-core/INSIGHTS.md explicitly, which is the exact file the CLAUDE.md-routing case
 * asserts on: the case was grading the hook, not CLAUDE.md. The Stop hook is worse — it blocks
 * the session and orders "invoke the engineering-insights skill" whenever the working tree is
 * dirty, so the near-miss negative ("must NOT record an insight") passed or failed depending on
 * the developer's git status. Evals must see the artifacts under test, not a hook reciting them.
 */
export const EVAL_ENV_FLAG = "DEVDIGEST_EVAL";

// --- Output verbosity -------------------------------------------------------
// Set EVAL_QUIET to suppress per-run trace/verdict spam during multi-run aggregation.
export const QUIET = Boolean(process.env.EVAL_QUIET);
