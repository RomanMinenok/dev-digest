/**
 * eval/run-log.ts — optional per-sweep file logging of eval runs.
 *
 * Debug/observability sink, gated by `EVAL_RUN_LOG_ENABLED` (see
 * `platform/config.ts`). One Markdown file per sweep — its name carries the
 * sweep start time, the agent, and the agent version, so all cases of one "Run"
 * land in the same file and two versions of the same agent produce two
 * comparable files:
 *
 *   <HH-mm-ss>-<DD.MM.YY>-<agent-slug>-v<version>.md
 *
 * (`:` is intentionally rendered as `-` — a colon is not a safe filename char.)
 *
 * Kept out of the pure runner logic on purpose: this is the one place in the
 * eval module that touches the filesystem, isolated behind a single append
 * function so `runner.ts` stays a thin call site.
 */
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Slugify an agent name into a filename-safe token. */
export function slugifyAgentName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'agent';
}

/** Two-digit zero-pad. */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Build the log file path for a sweep. `now` is captured ONCE at sweep start so
 * every case in the sweep appends to the same file.
 */
export function evalRunLogPath(dir: string, now: Date, agentName: string, version: number): string {
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const date = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${String(now.getFullYear()).slice(-2)}`;
  const file = `${time}-${date}-${slugifyAgentName(agentName)}-v${version}.md`;
  return join(dir, file);
}

/**
 * A Markdown code fence long enough to safely wrap `content` even when the
 * content itself contains ``` runs (system prompts routinely do). Picks a
 * backtick run one longer than the longest run inside, min 3.
 */
function fenced(content: string, lang = ''): string {
  const longest = (content.match(/`+/g) ?? []).reduce((m, r) => Math.max(m, r.length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${content}\n${fence}`;
}

export interface EvalRunLogEntry {
  caseName: string;
  agentName: string;
  version: number;
  pass: boolean;
  recall: number | null;
  precision: number | null;
  citationAccuracy: number | null;
  costUsd: number | null;
  durationMs: number;
  kept: number;
  dropped: number;
  systemPrompt: string;
  userPrompt: string;
  /** Raw, unparsed model output (joined across chunks for map-reduce). */
  rawResponse: string;
  expected: unknown;
  produced: unknown;
  droppedFindings: unknown;
}

function pct(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`;
}

/** Render one eval run as a Markdown section. */
export function formatEvalRunLog(entry: EvalRunLogEntry, now: Date): string {
  const cost = entry.costUsd == null ? '—' : `$${entry.costUsd.toFixed(4)}`;
  const json = (v: unknown) => fenced(JSON.stringify(v, null, 2), 'json');
  return [
    `# EVAL RUN — ${entry.caseName}`,
    '',
    `- **Agent:** ${entry.agentName} (v${entry.version})`,
    `- **At:** ${now.toISOString()}`,
    `- **Result:** ${entry.pass ? '✅ PASS' : '❌ FAIL'}`,
    `- **Recall / Precision / Citation:** ${pct(entry.recall)} / ${pct(entry.precision)} / ${pct(
      entry.citationAccuracy,
    )}`,
    `- **Cost:** ${cost} · **Duration:** ${entry.durationMs}ms · **Kept / Dropped:** ${entry.kept} / ${entry.dropped}`,
    '',
    '## System Prompt',
    '',
    fenced(entry.systemPrompt),
    '',
    '## User Prompt',
    '',
    fenced(entry.userPrompt),
    '',
    '# ▼ MODEL RESPONSE',
    '',
    fenced(entry.rawResponse),
    '',
    '## Expected Findings',
    '',
    json(entry.expected),
    '',
    '## Produced Findings',
    '',
    json(entry.produced),
    '',
    '## Dropped by Grounding',
    '',
    json(entry.droppedFindings),
    '',
    '---',
    '',
    '',
  ].join('\n');
}

/** Append one eval run entry to `filePath` (creating the directory if needed). */
export async function appendEvalRunLog(
  filePath: string,
  entry: EvalRunLogEntry,
  now: Date = new Date(),
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await appendFile(filePath, formatEvalRunLog(entry, now), 'utf8');
}
