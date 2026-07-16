import { parse } from 'yaml';
import { BadRequestError } from '../../platform/errors.js';
import { MAX_WORKFLOW_OVERRIDE_BYTES } from './constants.js';

const REQUIRED_PERMISSIONS = {
  contents: 'read',
  'pull-requests': 'write',
} as const;

const SECRET_PATTERNS: readonly RegExp[] = [
  /gh[ps]_[A-Za-z0-9]{36,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /-----BEGIN .* PRIVATE KEY-----/,
];

/** Matches the fork guard emitted by `workflowYaml` (AC-19). */
const FORK_CONDITION_PATTERN =
  /github\.event\.pull_request\.head\.repo\.fork\s*==\s*false/;

export interface ValidateWorkflowOverrideDeps {
  /** Resolved secret values from SecretsProvider — never logged on rejection. */
  secretValues: string[];
}

/**
 * Security gate for client-submitted workflow overrides (AC-44, AC-47).
 * Throws `BadRequestError` naming the failed rule only — never the matched text.
 */
export function validateWorkflowOverride(
  yamlText: string,
  deps: ValidateWorkflowOverrideDeps,
): void {
  if (Buffer.byteLength(yamlText, 'utf8') > MAX_WORKFLOW_OVERRIDE_BYTES) {
    throw new BadRequestError('Workflow override exceeds the maximum allowed size');
  }

  let doc: unknown;
  try {
    doc = parse(yamlText);
  } catch {
    throw new BadRequestError('Workflow override is not valid YAML');
  }

  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new BadRequestError('Workflow override is not valid YAML');
  }

  for (const value of deps.secretValues) {
    if (value.length > 0 && yamlText.includes(value)) {
      throw new BadRequestError('Workflow override contains a configured secret value');
    }
  }

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(yamlText)) {
      throw new BadRequestError('Workflow override matches a secret-shaped pattern');
    }
  }

  const workflow = doc as Record<string, unknown>;

  if (!permissionsMatchRequired(workflow.permissions)) {
    throw new BadRequestError(
      'Workflow override permissions must be exactly contents: read and pull-requests: write',
    );
  }

  const jobs = workflow.jobs;
  if (jobs && typeof jobs === 'object' && !Array.isArray(jobs)) {
    for (const job of Object.values(jobs as Record<string, unknown>)) {
      if (
        job &&
        typeof job === 'object' &&
        !Array.isArray(job) &&
        'permissions' in job &&
        !permissionsMatchRequired((job as Record<string, unknown>).permissions)
      ) {
        throw new BadRequestError(
          'Workflow override permissions must be exactly contents: read and pull-requests: write',
        );
      }
    }
  }

  assertForkCondition(workflow);
}

function permissionsMatchRequired(permissions: unknown): boolean {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    return false;
  }

  const perm = permissions as Record<string, unknown>;
  const keys = Object.keys(perm);

  if (keys.length !== Object.keys(REQUIRED_PERMISSIONS).length) {
    return false;
  }

  return (
    perm.contents === REQUIRED_PERMISSIONS.contents &&
    perm['pull-requests'] === REQUIRED_PERMISSIONS['pull-requests']
  );
}

function assertForkCondition(workflow: Record<string, unknown>): void {
  const jobs = workflow.jobs;
  if (!jobs || typeof jobs !== 'object' || Array.isArray(jobs)) {
    throw new BadRequestError('Workflow override is missing the fork pull request guard');
  }

  const jobEntries = Object.entries(jobs as Record<string, unknown>);
  if (jobEntries.length === 0) {
    throw new BadRequestError('Workflow override is missing the fork pull request guard');
  }

  for (const [, job] of jobEntries) {
    if (!job || typeof job !== 'object' || Array.isArray(job)) {
      throw new BadRequestError('Workflow override is missing the fork pull request guard');
    }

    const ifCondition = (job as Record<string, unknown>).if;
    if (typeof ifCondition !== 'string' || !FORK_CONDITION_PATTERN.test(ifCondition)) {
      throw new BadRequestError('Workflow override is missing the fork pull request guard');
    }
  }
}
