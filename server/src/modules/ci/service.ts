import AdmZip from 'adm-zip';
import type {
  CiExport,
  CiExportInput,
  CiInstallation,
  CiPreview,
  CiRun,
  CiRunStatus,
  GitHubClient,
  SecretsProvider,
} from '@devdigest/shared';
import type { AgentRow, SkillRow } from '../../db/rows.js';
import { BadRequestError, NotFoundError } from '../../platform/errors.js';
import { BRANCH, PR_TITLE, WORKFLOW_PATH_TEMPLATE } from './constants.js';
import { buildCiFiles } from './files.js';
import { ingestCiRuns } from './ingest.js';
import type { CiIngestAgentContext } from './ingest.js';
import type {
  CiInstallationRow,
  CiRepository,
  CiRunListRow,
  ListCiRunsFilters,
} from './repository.js';
import { parseRepoRef } from './repo-ref.js';
import { assertUniqueSlugs, slugify } from './slug.js';
import { validateWorkflowOverride } from './validate-workflow.js';

// ── Service deps (composition root wires these — no Container import) ────────

export interface CiServiceDeps {
  repo: CiRepository;
  /** Resolved on first use — avoids requiring GITHUB_TOKEN at server boot. */
  github: () => Promise<GitHubClient>;
  secrets: SecretsProvider;
  readBundle: () => Buffer;
  resolveAgent: (workspaceId: string, agentId: string) => Promise<AgentRow | undefined>;
  linkedSkills: (agentId: string) => Promise<Array<{ skill: SkillRow; order: number }>>;
  listWorkspaceAgents: (workspaceId: string) => Promise<Array<{ id: string; name: string }>>;
}

export type CiPreviewInput = Omit<CiExportInput, 'action'>;

/** Installation row plus derived status from the latest CI run (AC-41). */
export type CiInstallationWithStatus = CiInstallation & {
  status: string | null;
};

export type CiExportFilesResult = {
  zip: Buffer;
  installation: CiInstallation;
};

// ── DTO mappers ──────────────────────────────────────────────────────────────

function toCiInstallationDto(row: CiInstallationRow): CiInstallation {
  return {
    id: row.id,
    agent_id: row.agentId,
    repo: row.repo,
    target_type: row.targetType,
    installed_at: row.installedAt.toISOString(),
  };
}

function ciRunStatusForDto(status: string | null, runId: string | null): CiRunStatus | null {
  if (status === 'failed') {
    return runId == null ? 'error' : 'changes_requested';
  }
  return status as CiRunStatus | null;
}

function toCiRunDto(row: CiRunListRow): CiRun {
  const { ciRun, agentName, repo, durationMs, runCostUsd } = row;
  return {
    id: ciRun.id,
    ci_installation_id: ciRun.ciInstallationId,
    pr_number: ciRun.prNumber,
    ran_at: ciRun.ranAt?.toISOString() ?? null,
    status: ciRunStatusForDto(ciRun.status, ciRun.runId),
    findings_count: ciRun.findingsCount,
    cost_usd: ciRun.costUsd ?? runCostUsd ?? null,
    github_url: ciRun.githubUrl,
    source: ciRun.source,
    agent: agentName ?? null,
    duration_s: durationMs != null ? durationMs / 1000 : null,
    run_id: ciRun.runId,
    pr_title: ciRun.prTitle,
    repo,
    critical: ciRun.critical,
    warning: ciRun.warning,
    suggestion: ciRun.suggestion,
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

const SECRET_KEYS = [
  'GITHUB_TOKEN',
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
] as const;

function requireRepoRef(fullName: string) {
  const ref = parseRepoRef(fullName);
  if (!ref) {
    throw new BadRequestError(`Invalid repository "${fullName}" — expected "owner/name"`);
  }
  return ref;
}

function workflowPathForSlug(slug: string): string {
  return WORKFLOW_PATH_TEMPLATE.replace('<slug>', slug);
}

function applyWorkflowOverride(
  files: CiPreview['files'],
  slug: string,
  override: string | null | undefined,
): CiPreview['files'] {
  if (override == null) return files;
  const workflowPath = workflowPathForSlug(slug);
  return files.map((file) =>
    file.path === workflowPath ? { ...file, contents: override } : file,
  );
}

async function resolveSecretValues(secrets: SecretsProvider): Promise<string[]> {
  const values = await Promise.all(SECRET_KEYS.map((key) => secrets.get(key)));
  return values.filter((value): value is string => value != null && value.length > 0);
}

function buildZip(files: CiPreview['files']): Buffer {
  const zip = new AdmZip();
  for (const file of files) {
    zip.addFile(file.path, Buffer.from(file.contents, 'utf8'));
  }
  return zip.toBuffer();
}

// ── Service ──────────────────────────────────────────────────────────────────

export class CiService {
  constructor(private deps: CiServiceDeps) {}

  /**
   * Non-mutating preview of the export file set (AC-12). No GitHub calls, no
   * DB writes. Validates slug collisions across workspace agents (Decision 1).
   */
  async preview(
    workspaceId: string,
    agentId: string,
    input: CiPreviewInput,
  ): Promise<CiPreview> {
    const { files, total_bytes } = await this.generateFiles(workspaceId, agentId, input, {
      validateOverride: false,
    });
    return { files, total_bytes };
  }

  /**
   * Export CI files — open a PR or return a zip (AC-22 through AC-25). Persists
   * the installation row on completion of either action.
   */
  async export(
    workspaceId: string,
    agentId: string,
    input: CiExportInput,
  ): Promise<CiExport | CiExportFilesResult> {
    const { files } = await this.generateFiles(workspaceId, agentId, input, {
      validateOverride: true,
    });

    const repoRef = requireRepoRef(input.repo);
    const installationRow = await this.deps.repo.upsertInstallation({
      agentId,
      repo: input.repo,
      targetType: input.target,
    });
    const installation = toCiInstallationDto(installationRow);

    if (input.action === 'files') {
      return {
        zip: buildZip(files),
        installation,
      };
    }

    const github = await this.deps.github();
    await github.commitFiles(repoRef, {
      branch: BRANCH,
      base: input.base,
      message: 'Update DevDigest CI configuration',
      files: files.map((file) => ({ path: file.path, contents: file.contents })),
    });

    let prUrl = (await github.findOpenPr(repoRef, BRANCH))?.url ?? null;
    if (!prUrl) {
      const opened = await github.openPullRequest(repoRef, {
        title: PR_TITLE,
        head: BRANCH,
        base: input.base,
        body: 'Adds DevDigest CI review workflow and agent configuration.',
      });
      prUrl = opened.url;
    }

    return {
      installation,
      files,
      pr_url: prUrl,
    };
  }

  /**
   * Ingest new workflow runs then list CI runs for the workspace (AC-26, Decision 6).
   */
  async listRuns(workspaceId: string, filters: ListCiRunsFilters = {}): Promise<CiRun[]> {
    await ingestCiRuns(
      {
        github: await this.deps.github(),
        repo: this.deps.repo,
        resolveAgent: (agentId) => this.resolveAgentForIngest(workspaceId, agentId),
      },
      workspaceId,
      { repo: filters.repo },
    );

    const rows = await this.deps.repo.listCiRuns(workspaceId, filters);
    return rows.map(toCiRunDto);
  }

  /**
   * Installations for one agent with status derived from each installation's
   * most recent CI run (AC-41) — not a stored column.
   */
  async listInstallations(
    workspaceId: string,
    agentId: string,
  ): Promise<CiInstallationWithStatus[]> {
    const agent = await this.deps.resolveAgent(workspaceId, agentId);
    if (!agent) throw new NotFoundError('Agent not found');

    const installations = await this.deps.repo.listInstallations(workspaceId, { agentId });
    if (installations.length === 0) return [];

    const latestRuns = await this.deps.repo.latestRunPerInstallation(
      installations.map((installation) => installation.id),
    );
    const statusByInstallation = new Map(
      latestRuns.map((row) => [
        row.ciInstallationId,
        ciRunStatusForDto(row.ciRun.status, row.ciRun.runId),
      ]),
    );

    return installations.map((installation) => ({
      ...toCiInstallationDto(installation),
      status: statusByInstallation.get(installation.id) ?? null,
    }));
  }

  private async resolveAgentForIngest(
    workspaceId: string,
    agentId: string,
  ): Promise<CiIngestAgentContext | undefined> {
    const agent = await this.deps.resolveAgent(workspaceId, agentId);
    if (!agent) return undefined;
    return {
      id: agent.id,
      workspaceId: agent.workspaceId,
      name: agent.name,
      provider: agent.provider,
      model: agent.model,
      ciFailOn: agent.ciFailOn,
    };
  }

  private async generateFiles(
    workspaceId: string,
    agentId: string,
    input: CiPreviewInput,
    opts: { validateOverride: boolean },
  ): Promise<CiPreview> {
    const agent = await this.deps.resolveAgent(workspaceId, agentId);
    if (!agent) throw new NotFoundError('Agent not found');

    const workspaceAgents = await this.deps.listWorkspaceAgents(workspaceId);
    assertUniqueSlugs(workspaceAgents);

    const slug = slugify(agent.name);
    const linkedSkills = await this.deps.linkedSkills(agentId);

    const built = buildCiFiles(
      {
        agent,
        slug,
        linkedSkills,
        triggers: input.triggers,
        postAs: input.post_as,
      },
      { readBundle: this.deps.readBundle },
    );

    if (opts.validateOverride && input.workflow_override != null) {
      const secretValues = await resolveSecretValues(this.deps.secrets);
      validateWorkflowOverride(input.workflow_override, { secretValues });
    }

    const files = applyWorkflowOverride(built.files, slug, input.workflow_override);
    const total_bytes = files.reduce(
      (sum, file) => sum + Buffer.byteLength(file.contents, 'utf8'),
      0,
    );

    return { files, total_bytes };
  }
}
