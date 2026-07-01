import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { LLMProvider } from '@devdigest/shared';

const MAX_SAMPLES = 12;
const MAX_FILE_CHARS = 8_000;
const DEBUG = process.env.CONVENTIONS_DEBUG === 'true';

const CONFIG_FILES = [
  'tsconfig.json',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  'eslint.config.js',
  'eslint.config.mjs',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  'prettier.config.js',
  'biome.json',
  'biome.jsonc',
  '.editorconfig',
];

const SYSTEM_MESSAGE = `You are a code-convention analyst. Analyze the provided code samples and
extract concrete coding conventions consistently followed in this repository.
Return ONLY conventions that: have clear evidence in the provided files,
can be formulated as a specific actionable rule (start with Always/Never/Use X
instead of Y), appear in at least 2 places or are configured explicitly,
would be useful for a code reviewer to enforce.
Do NOT include generic best practices obvious to any TypeScript developer,
things with only 1 example unless in a config file, or framework defaults.`;

const USER_TEMPLATE = (repoName: string, fileContents: string) =>
  `Repository: ${repoName}
Analyze these files and extract coding conventions:
${fileContents}
Return JSON with candidates array: rule (imperative form), evidence_path (relative path), evidence_snippet (2-5 lines of exact code), confidence (0.0-1.0). Only include conventions with confidence > 0.6.`;

const ExtractionResponse = z.object({
  candidates: z.array(
    z.object({
      rule: z.string(),
      evidence_path: z.string(),
      evidence_snippet: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export interface ExtractInput {
  repoName: string;
  clonePath: string;
  samplePaths: string[];
  llm: LLMProvider;
  model: string;
}

export interface ConventionDraft {
  rule: string;
  evidence_path: string;
  evidence_snippet: string;
  confidence: number;
}

export async function extractConventions(input: ExtractInput): Promise<ConventionDraft[]> {
  const { repoName, clonePath, llm, model } = input;
  const samplePaths = input.samplePaths.slice(0, MAX_SAMPLES);

  // Step 1: read config files
  const configEntries = await Promise.all(
    CONFIG_FILES.map(async (name) => {
      const content = await readFile(join(clonePath, name), 'utf8').catch(() => null);
      return content != null ? { name, content } : null;
    }),
  );
  const configs = configEntries.filter((e): e is { name: string; content: string } => e !== null);
  if (DEBUG) console.log('[conventions] config files found:', configs.map((c) => c.name));

  // Step 2: read source samples
  const sourceEntries = await Promise.all(
    samplePaths.map(async (relPath) => {
      const raw = await readFile(join(clonePath, relPath), 'utf8').catch(() => null);
      if (raw == null) return null;
      const content = raw.length > MAX_FILE_CHARS ? raw.slice(0, MAX_FILE_CHARS) + '\n[truncated]' : raw;
      return { name: relPath, content };
    }),
  );
  const sources = sourceEntries.filter((e): e is { name: string; content: string } => e !== null);
  if (DEBUG) console.log('[conventions] source files picked:', sources.map((s) => s.name));

  // Build file payload: configs first, then sources
  const all = [...configs, ...sources];
  const fileContents = all
    .map((f) => `--- ${f.name} ---\n${f.content}`)
    .join('\n\n');

  // Step 3+4: LLM call
  if (DEBUG) {
    console.log('[conventions] sending to LLM — model:', model);
    console.log('[conventions] system message:\n', SYSTEM_MESSAGE);
    console.log('[conventions] user message:\n', USER_TEMPLATE(repoName, fileContents));
  }
  const res = await llm.completeStructured({
    model,
    schemaName: 'conventions',
    schema: ExtractionResponse,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_MESSAGE },
      { role: 'user', content: USER_TEMPLATE(repoName, fileContents) },
    ],
  });

  if (DEBUG) console.log('[conventions] LLM raw response:', JSON.stringify(res.data.candidates, null, 2));

  // Step 5a: filter by confidence
  const filtered = res.data.candidates.filter((c) => c.confidence > 0.6);
  if (DEBUG) console.log('[conventions] after confidence filter (>0.6):', filtered.map((c) => `${c.confidence.toFixed(2)} ${c.rule}`));

  // Step 5b: anti-hallucination verification
  const verified: ConventionDraft[] = [];
  for (const candidate of filtered) {
    const fileContent = await readFile(join(clonePath, candidate.evidence_path), 'utf8').catch(() => null);
    if (fileContent == null) continue;

    const firstLine = candidate.evidence_snippet.split('\n')[0]?.trim() ?? '';
    if (!firstLine) continue;

    const found = fileContent.split('\n').some((line) => line.trim() === firstLine);
    if (!found) {
      if (DEBUG) console.log('[conventions] DROPPED (hallucination gate):', candidate.evidence_path, '— first line not found:', JSON.stringify(firstLine));
      continue;
    }

    verified.push({
      rule: candidate.rule,
      evidence_path: candidate.evidence_path,
      evidence_snippet: candidate.evidence_snippet,
      confidence: candidate.confidence,
    });
  }

  if (DEBUG) console.log('[conventions] verified candidates:', verified.length, verified.map((c) => c.rule));
  return verified;
}
