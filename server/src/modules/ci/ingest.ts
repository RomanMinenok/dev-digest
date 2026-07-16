import AdmZip from 'adm-zip';
import type { CiFailOn, CiWorkflowRun, GitHubClient } from '@devdigest/shared';
import { CiResultArtifact } from '@devdigest/shared';
import {
  ARTIFACT_NAME_TEMPLATE,
  RESULT_PATH_TEMPLATE,
  SLUG_PLACEHOLDER,
  WORKFLOW_PATH_TEMPLATE,
} from './constants.js';
import { mapCiIngestInput } from './map-ingest.js';
import type { CiRepository } from './repository.js';
import { parseRepoRef } from './repo-ref.js';
import { slugify } from './slug.js';
import { ciRunStatus } from './verdict.js';

/** Batch size for parallel installation ingest (p95 target: 10 installations < 3s). */
const INSTALLATION_BATCH_SIZE = 3;

export interface CiIngestAgentContext {
  id: string;
  workspaceId: string;
  name: string;
  provider: string;
  model: string;
  ciFailOn: CiFailOn;
}

export interface CiIngestDeps {
  github: GitHubClient;
  repo: CiRepository;
  /** Agent fields needed for mapping + gate — not returned by `listInstallations`. */
  resolveAgent: (agentId: string) => Promise<CiIngestAgentContext | undefined>;
}

export interface CiIngestOptions {
  /** Optional active-repo filter (Decision 6) — same scope as `GET /ci-runs`. */
  repo?: string;
}

function resolveSlug(template: string, slug: string): string {
  return template.replace(SLUG_PLACEHOLDER, slug);
}

function workflowFileName(slug: string): string {
  const path = resolveSlug(WORKFLOW_PATH_TEMPLATE, slug);
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

function zipEntryBaseName(entryPath: string): string {
  const parts = entryPath.split('/');
  return parts[parts.length - 1] ?? entryPath;
}

/**
 * Read exactly one named JSON entry from a GitHub artifact zip; ignore every
 * other entry (AC-27). Returns `null` when the expected entry is absent.
 */
function readNamedJsonFromZip(buf: Buffer, expectedBaseName: string): unknown | null {
  const zip = new AdmZip(buf);
  const entry = zip
    .getEntries()
    .filter((e) => !e.isDirectory)
    .find((e) => zipEntryBaseName(e.entryName) === expectedBaseName);

  if (!entry) return null;

  try {
    return JSON.parse(entry.getData().toString('utf8'));
  } catch {
    return null;
  }
}

/** Skip in-progress runs; only completed workflow runs are ingested. */
function isCompletedRun(run: CiWorkflowRun): boolean {
  return run.status === 'completed';
}

/**
 * AC-31: status-only row when no artifact — derived from the Actions API
 * conclusion (completed runs without a downloadable artifact are failures).
 */
function statusFromConclusion(conclusion: string | null): string {
  if (conclusion === 'success') return 'failed';
  if (conclusion === 'failure') return 'failed';
  if (conclusion === 'cancelled') return 'failed';
  if (conclusion === 'timed_out') return 'failed';
  if (conclusion === 'action_required') return 'failed';
  if (conclusion === 'skipped') return 'failed';
  if (conclusion === 'stale') return 'failed';
  if (conclusion === 'neutral') return 'failed';
  return 'failed';
}

async function mapInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(fn));
  }
}

async function ingestInstallation(
  deps: CiIngestDeps,
  installation: { id: string; agentId: string; repo: string; targetType: string },
): Promise<void> {
  const agent = await deps.resolveAgent(installation.agentId);
  if (!agent) return;

  const repoRef = parseRepoRef(installation.repo);
  if (!repoRef) return;

  const slug = slugify(agent.name);
  const workflow = workflowFileName(slug);
  const artifactName = resolveSlug(ARTIFACT_NAME_TEMPLATE, slug);
  const resultEntryName = resolveSlug(RESULT_PATH_TEMPLATE, slug);

  const existingKeys = await deps.repo.existingRunKeys(installation.id);

  // AC-28: 403 / missing actions:read scope must propagate — never swallow as success.
  const runs = await deps.github.listWorkflowRuns(repoRef, workflow);

  for (const run of runs) {
    if (!isCompletedRun(run)) continue;
    if (existingKeys.has(run.html_url)) continue;

    const ranAt = new Date(run.created_at);
    const zipBuf = await deps.github.downloadRunArtifact(repoRef, run.id, artifactName);

    if (!zipBuf) {
      await deps.repo.ingestRun(
        mapCiIngestInput({
          installation,
          agent,
          githubUrl: run.html_url,
          ranAt,
          status: statusFromConclusion(run.conclusion),
          artifact: null,
        }),
      );
      existingKeys.add(run.html_url);
      continue;
    }

    const raw = readNamedJsonFromZip(zipBuf, resultEntryName);
    if (raw == null) continue;

    const parsed = CiResultArtifact.safeParse(raw);
    if (!parsed.success) continue;

    const artifact = parsed.data;
    const counts = {
      critical: artifact.critical ?? 0,
      warning: artifact.warning ?? 0,
      suggestion: artifact.suggestion ?? 0,
    };

    await deps.repo.ingestRun(
      mapCiIngestInput({
        installation,
        agent,
        githubUrl: run.html_url,
        ranAt,
        prNumber: artifact.pr_number ?? null,
        status: ciRunStatus(counts, agent.ciFailOn),
        artifact,
      }),
    );
    existingKeys.add(run.html_url);
  }
}

/**
 * Synchronously ingest new GitHub Actions workflow runs for in-scope
 * installations (AC-26). Called from `GET /ci-runs` — no timers, no background
 * refetch.
 */
export async function ingestCiRuns(
  deps: CiIngestDeps,
  workspaceId: string,
  opts: CiIngestOptions = {},
): Promise<void> {
  const installations = await deps.repo.listInstallations(workspaceId, {
    repo: opts.repo,
  });

  await mapInBatches(installations, INSTALLATION_BATCH_SIZE, (installation) =>
    ingestInstallation(deps, installation),
  );
}
