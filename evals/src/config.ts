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

// --- Output verbosity -------------------------------------------------------
// Set EVAL_QUIET to suppress per-run trace/verdict spam during multi-run aggregation.
export const QUIET = Boolean(process.env.EVAL_QUIET);
