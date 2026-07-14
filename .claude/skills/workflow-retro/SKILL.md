---
name: workflow-retro
description: "Analyzes the just-finished multi-agent pipeline run in the current session — tokens, cache-hit, tool-calls, durations, parallelism — including nested subagent transcripts read from disk (deep mode, always on), since the parent session's own usage undercounts subagent work. Produces insights + concrete recommendations, and appends one row to docs/retros/ledger.md so runs can be compared over time. Manual only, no hook. Invoke with /workflow-retro."
user-invocable: true
allowed-tools: Read, Bash, Glob, Grep, Write, Edit
---

# Workflow Retro

A manual, on-demand retro over the pipeline run that just happened in this
session (`spec-creator → implementation-planner → implementer → test-writer →
architecture-reviewer → plan-verifier`, per `.claude/agents/README.md`, or
whatever subset actually ran). Turns raw transcript data into real metrics,
honest insights, and one comparable ledger row. Never runs automatically —
invoke it by hand after a pipeline run is worth dissecting.

## Why deep mode is not optional

The parent session's own `<usage>` only reflects the orchestrator's tokens.
Every `Agent`/`Task` dispatch returns a text summary to the parent — not the
subagent's real token/tool-call data. Reading only the parent transcript
silently undercounts everything a `spec-creator`, `implementer`, etc. did.
This skill therefore always reads subagent transcripts from disk; there is no
shallow/in-context-only mode.

## Step 1 — Locate this session's transcripts

1. Derive the project slug from `cwd` (dashes replace `/`), e.g.
   `/Users/addsense/Workspace/dev-digest` → `-Users-addsense-Workspace-dev-digest`.
2. The project's transcript directory is
   `~/.claude/projects/<slug>/`. Find the current session's top-level log by
   picking the most-recently-modified `*.jsonl` directly in that directory
   (not inside a `subagents/` folder):
   ```bash
   ls -t ~/.claude/projects/<slug>/*.jsonl | head -1
   ```
   This is a heuristic (there's no session-id env var exposed) — sanity-check
   it by confirming the file's last few lines match the conversation that
   just happened (recent user/assistant text, current git branch).
3. The session's nested-agent directory is
   `~/.claude/projects/<slug>/<sessionId>/subagents/`, where `<sessionId>` is
   that file's basename without `.jsonl`. Each dispatched `Agent` call left a
   pair: `agent-<id>.jsonl` (the subagent's own transcript, same shape as the
   parent) and `agent-<id>.meta.json` (`agentType`, `description`,
   `spawnDepth`, `stoppedByUser`).
4. **Recurse**: if a subagent itself dispatched further agents (e.g.
   `implementation-planner` calling `researcher`), its own transcript
   directory (`~/.claude/projects/<slug>/<subSessionId>/subagents/`, keyed by
   that subagent's own session id if present, or check for a nested
   `subagents/` alongside its jsonl) may contain its own subagent pairs.
   Walk this recursively; track `spawnDepth` from each `.meta.json` for
   reporting.
5. If no `subagents/` directory exists for this session, the run was
   single-agent — report that plainly and skip straight to Step 2 metrics
   on the parent transcript alone.

## Step 2 — Compute metrics (per agent, then rolled up)

For the parent transcript and every (recursive) subagent transcript found in
Step 1:

- **Tokens**: sum each `assistant` message's `message.usage` fields —
  `input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
  `cache_read_input_tokens`.
- **Cache-hit rate**: `cache_read_input_tokens / (cache_read_input_tokens + cache_creation_input_tokens + input_tokens)`.
- **Tool-calls**: count `content` blocks with `type: "tool_use"`, grouped by
  tool name (`Read`, `Edit`, `Bash`, `Agent`, …).
- **Duration**: `max(timestamp) − min(timestamp)` across the transcript's
  entries (wall-clock, not billed compute — say so in the report).
- **Parallelism**: in the parent (or any orchestrating) transcript, a single
  assistant turn containing multiple `Agent`-type `tool_use` blocks is one
  parallel wave — count how many agents per wave, and cross-check against
  the actual time-range overlap of those agents' own transcripts (a wave
  isn't real parallelism if the sub-transcripts don't actually overlap in
  time).
- **Stage mapping**: label each subagent transcript by its `.meta.json`
  `agentType` (fall back to `description` text if `agentType` is generic,
  e.g. distinguishing a `researcher` nested inside `implementation-planner`
  from a top-level one) so the report speaks in pipeline-stage terms, not
  opaque agent IDs.
- **Pipeline total**: sum every per-agent metric above across the whole tree
  for one "total tokens", "total tool-calls", "total wall-clock" (note total
  wall-clock is the parent's span, not a sum of subagent spans, since
  parallel agents overlap).

Use `jq` (or Python if `jq` isn't available) for these — do not hand-parse
JSON with `grep`/`sed`, the payloads are nested and multi-line.

## Step 3 — Insights and recommendations

Turn the numbers into judgments — this is the point of the skill, not the
tables:

- **Expensive relative to output**: an agent with high tokens/low cache-hit
  and a thin or redundant result.
- **Duplicated work**: the same file path appearing as a `Read` tool call
  across two or more sibling transcripts — a sign a shared file should have
  been pre-fetched once and passed into the dispatch prompt instead.
- **Missed stages**: compare which pipeline stages from
  `.claude/agents/README.md`'s catalog actually ran against which should
  have for this kind of change (e.g. `plan-verifier` skipped after an
  `implementer` wave).
- **Concrete actions only** — each insight ends in one of: tighten a specific
  agent's dispatch prompt, pre-fetch a named file instead of N re-reads,
  merge/split specific agents, switch a wave from sequential to `[P]` (or
  vice versa if "parallel" agents never actually overlapped).

Skip an insight if it's not actionable — a bare number restated in prose
isn't an insight.

## Step 4 — Append to the ledger

`docs/retros/ledger.md` is a running comparison table, one row per retro. If
the file doesn't exist, create it with this header first:

```markdown
# Workflow Retro Ledger

| Date | Pipeline/Feature | Stages run | Total tokens (in/out/cache-read) | Cache-hit % | Tool-calls | Wall-clock | Parallelism (waves) | Top finding |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

Append exactly one row for this run (today's date, what feature/branch the
pipeline was working on, which pipeline stages actually ran, the rolled-up
totals from Step 2, and the single most important finding from Step 3 —
short enough to scan). Never rewrite prior rows.

## Step 5 — Report to the user

```
# Workflow Retro — <feature/branch>

## Run shape
<stages that ran, in order, with spawnDepth noted for nested agents>

## Metrics (deep — includes nested subagents)
<per-agent table: tokens, cache-hit %, tool-calls, duration>
<pipeline totals>

## Parallelism
<waves found, agents per wave, whether sub-transcripts actually overlapped in time>

## Insights
<the actionable findings from Step 3>

## Ledger
Appended to docs/retros/ledger.md — <one-line of the row just added>
```

## Rules

- **Manual only.** Never wire this into a hook; the user runs it by hand
  when a pipeline run is worth dissecting.
- **Deep mode always.** Never skip subagent transcripts — that's the entire
  reason this skill exists over reading `<usage>` alone.
- **Evidence, not vibes.** Every number in the report must come from an
  actual `usage`/`tool_use`/timestamp field in a transcript file, not an
  estimate.
- **Append-only ledger.** One row per run, never edit or delete prior rows.
- **Actionable insights only.** If a finding doesn't end in a concrete next
  action, cut it.
