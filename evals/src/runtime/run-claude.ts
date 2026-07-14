/**
 * The headless turn-loop driver. Runs one Claude Agent SDK session on the subscription and
 * extracts what the session ACTUALLY did (tools, subagents, skills, reads) — not its prose.
 */

import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { DISALLOWED_TOOLS, EVAL_MODEL, MAX_TURNS, SPAWN_TOOLS } from "../config.js";
import { REPO_ROOT } from "../artifacts/paths.js";
import { subscriptionEnv } from "./env.js";

export interface Metrics {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  /** Total tool_use blocks seen (NOT deduplicated — a measure of work done). */
  toolCallCount: number;
}

/** One tool call, in the order it happened. `file` is set when the call read a file. */
export interface ToolCall {
  tool: string;
  file?: string;
}

export interface Result {
  text: string;
  toolsUsed: string[];
  subagents: string[];
  /** Skills activated via the Skill tool (workflow mode); name may be "plugin:skill". */
  skillsInvoked: string[];
  filesRead: string[];
  /**
   * Every tool call in order (with duplicates). `filesRead` says WHETHER a file was read;
   * this says HOW FAR IN — which is what separates "the map sent it straight there" from
   * "it searched the tree and stumbled on it". The contrast tier asserts on that distance.
   */
  toolLog: ToolCall[];
  numTurns: number;
  isError: boolean;
  metrics: Metrics;
}

/** How the subscription says "no": session/usage limit, or the API's rate-limit error. */
const LIMIT_SIGNATURE = /hit your (session|usage) limit|usage limit reached|rate_limit_error/i;

/**
 * Files a shell command reads. `filesRead` used to come only from the Read tool, so a model that
 * ran `cat e2e/README.md` looked like it had read nothing and the case failed for a reason that
 * had nothing to do with the harness. Workflow sessions now block Bash outright, but agent-tier
 * sessions legitimately have it, so keep the trace honest wherever it runs.
 */
function bashReads(command: string): string[] {
  const out: string[] = [];
  const re = /\b(?:cat|bat|head|tail|less|more|sed)\b([^|;&\n]*)/g;
  for (const m of command.matchAll(re)) {
    for (const tok of m[1].split(/\s+/)) {
      // skip flags, sed scripts ('1,20p'), redirections
      if (!tok || tok.startsWith("-") || tok.startsWith("'") || tok.startsWith('"')) continue;
      if (/[/.]/.test(tok)) out.push(tok);
    }
  }
  return out;
}

export interface RunOptions {
  systemPrompt?: string;
  allowedTools?: string[];
  /**
   * Tools the session must NOT reach. Defaults to DISALLOWED_TOOLS. This — not `allowedTools` —
   * is the only thing that actually narrows the surface (see config.ts), so a tier that needs a
   * tighter box (workflowTask) passes its own list here.
   */
  disallowedTools?: string[];
  maxTurns?: number;
  cwd?: string;
  model?: string;
  /** ["project"] loads on-disk CLAUDE.md + skills/agents; default [] keeps the run isolated. */
  settingSources?: Array<"user" | "project" | "local">;
  /**
   * Early-stop hook. Called after every tool_use with the trace collected SO FAR; return true to
   * end the session immediately. Lets a dispatch/trace case stop the moment its evidence is in
   * (e.g. the subagent was launched) instead of waiting for a heavy nested subagent to finish.
   * On an early stop the run is NOT an error and metrics reflect only what ran before the stop.
   */
  stopWhen?: (partial: Pick<Result, "subagents" | "filesRead" | "skillsInvoked" | "toolsUsed">) => boolean;
}

/** Run one headless Claude turn-loop and extract what it ACTUALLY did (not its prose). */
export async function runClaude(prompt: string, opts: RunOptions = {}): Promise<Result> {
  const allowedTools = opts.allowedTools ?? [];
  // With no tools, a subagent/skill prompt that says "read files" will loop on denied tool
  // calls until max-turns. For these content-only evals the input is already in the prompt,
  // so tell the model to answer directly.
  let systemPrompt = opts.systemPrompt;
  if (allowedTools.length === 0) {
    const directive =
      "\n\nYou have NO tools available in this session. Do not attempt any tool calls. " +
      "Answer directly and completely from the information given in the prompt.";
    systemPrompt = (systemPrompt ?? "") + directive;
  }

  const options: Options = {
    model: opts.model ?? EVAL_MODEL,
    maxTurns: opts.maxTurns ?? MAX_TURNS,
    // bypassPermissions means nothing stands between the model and the working tree, and
    // allowedTools alone does NOT hide the built-ins — DISALLOWED_TOOLS is what actually keeps the
    // session read-only and forces artifacts to answer in prose. See its comment in config.ts.
    permissionMode: "bypassPermissions",
    systemPrompt,
    allowedTools,
    disallowedTools: opts.disallowedTools ?? DISALLOWED_TOOLS,
    cwd: opts.cwd ?? REPO_ROOT,
    // Default: do NOT load on-disk config — isolates the injected artifact. workflowTask overrides.
    settingSources: opts.settingSources ?? [],
    // settingSources:["project"] also drags in the repo's .mcp.json — traces showed sessions
    // calling mcp__devdigest__* and burning turns on tools no eval asserts on. We pass no
    // mcpServers, so this leaves the session with none.
    strictMcpConfig: true,
    env: subscriptionEnv(),
  };

  const textParts: string[] = [];
  const tools: string[] = [];
  const subagents: string[] = [];
  const skills: string[] = [];
  const reads: string[] = [];
  const toolLog: ToolCall[] = [];
  let resultText = "";
  let isError = false;
  let numTurns = 0;
  let toolCallCount = 0;
  // Resource metrics, read defensively off the result message (field names verified against the
  // installed SDK's types). On the subscription path total_cost_usd is meaningless, so we ignore
  // it and surface tokens only. Fall back to 0 whenever a field is absent — never throw.
  let durationMs = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let stoppedEarly = false;
  // Wall-clock fallback: on an early stop we break before the result message that carries
  // duration_ms/usage, so those stay 0. Stamp duration ourselves, and accumulate output tokens
  // off each assistant message, so an early-stopped case still reports meaningful metrics.
  const startedAt = Date.now();

  // The SDK throws on an error result (e.g. max-turns). We still want the partial output
  // and the tool/subagent trace we collected, so catch and fall through with isError=true.
  try {
    loop: for await (const msg of query({ prompt, options })) {
      if (msg.type === "assistant") {
        numTurns++;
        outputTokens += (msg.message as any).usage?.output_tokens ?? 0;
        for (const block of msg.message.content as any[]) {
          if (block.type === "text") textParts.push(block.text);
          else if (block.type === "tool_use") {
            tools.push(block.name);
            toolCallCount++;
            const input = block.input ?? {};
            const readsHere: string[] = [];
            if (SPAWN_TOOLS.has(block.name)) {
              const sub = input.subagent_type ?? input.agent_type ?? input.name;
              if (sub) subagents.push(sub);
            }
            if (block.name === "Read") {
              const fp = input.file_path ?? input.path;
              if (fp) readsHere.push(fp);
            }
            if (block.name === "Bash" && typeof input.command === "string") {
              readsHere.push(...bashReads(input.command));
            }
            if (block.name === "Skill") {
              const s = input.skill ?? input.command;
              if (s) skills.push(s);
            }
            reads.push(...readsHere);
            if (readsHere.length === 0) toolLog.push({ tool: block.name });
            else for (const f of readsHere) toolLog.push({ tool: block.name, file: f });
            // Evidence is in — break the loop before a heavy nested subagent runs to completion.
            // Breaking the async iterator triggers its return()/abort, tearing down the subprocess.
            if (
              opts.stopWhen?.({
                subagents: [...new Set(subagents)],
                filesRead: reads,
                skillsInvoked: [...new Set(skills)],
                toolsUsed: [...new Set(tools)],
              })
            ) {
              stoppedEarly = true;
              break loop;
            }
          }
        }
      } else if (msg.type === "result") {
        isError = msg.subtype !== "success";
        const m = msg as any;
        numTurns = m.num_turns ?? 0;
        durationMs = m.duration_ms ?? 0;
        inputTokens = m.usage?.input_tokens ?? 0;
        outputTokens = m.usage?.output_tokens ?? 0;
        if (m.result) resultText = m.result;
      }
    }
  } catch (err) {
    isError = true;
    if (!resultText && textParts.length === 0) {
      throw err; // nothing usable collected — surface the failure
    }
  }

  // Early stop never reached the result message, so fall back to the wall-clock duration.
  if (stoppedEarly && durationMs === 0) durationMs = Date.now() - startedAt;

  // A quota wall is NOT a result. The subscription answers "You've hit your session limit · resets
  // 8:40pm" in ~0.5s with an empty trace, which every case then scores as a legitimate FAIL —
  // indistinguishable, in records.jsonl, from the harness actually regressing. (It happened: a whole
  // 11-case run recorded 0/11 with empty traces.) Throw instead, so the suite dies loudly and the
  // run is never mistaken for evidence.
  if (LIMIT_SIGNATURE.test(resultText)) {
    throw new Error(
      `Subscription quota exhausted, not an eval result — the session returned: "${resultText.trim()}". ` +
        `Re-run after the reset; discard this run.`,
    );
  }

  return {
    text: resultText || textParts.join("\n"),
    toolsUsed: [...new Set(tools)],
    subagents: [...new Set(subagents)],
    skillsInvoked: [...new Set(skills)],
    filesRead: reads,
    toolLog,
    numTurns,
    isError,
    metrics: { durationMs, inputTokens, outputTokens, toolCallCount },
  };
}
