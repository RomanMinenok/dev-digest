import type { CiExportInput, CiFile } from '@devdigest/shared';
import type { AgentRow, SkillRow } from '../../db/rows.js';
import { BadRequestError } from '../../platform/errors.js';
import {
  AGENT_PATH_TEMPLATE,
  BUNDLE_PATH,
  MEMORY_PATH,
  RUNNER_PATH,
  SKILL_PATH_TEMPLATE,
  SLUG_PLACEHOLDER,
  WORKFLOW_PATH_TEMPLATE,
} from './constants.js';
import { agentYaml } from './manifest.js';
import { assertUniqueSlugs, slugify } from './slug.js';
import { workflowYaml } from './workflow.js';

/** Inputs resolved by the export service before generation (T19). */
export interface BuildCiFilesInput {
  agent: AgentRow;
  slug: string;
  /** Linked skills in link order; only enabled entries are exported (AC-7). */
  linkedSkills: Array<{ skill: SkillRow; order: number }>;
  triggers: CiExportInput['triggers'];
  postAs: CiExportInput['post_as'];
}

export interface BuildCiFilesResult {
  files: CiFile[];
  total_bytes: number;
}

function resolveSlugTemplate(template: string, slug: string): string {
  return template.replace(SLUG_PLACEHOLDER, slug);
}

function byteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

/**
 * Build the full CI file set for one agent export (AC-4 through AC-10).
 * Pure except for the injected bundle reader — never imports `fs` directly.
 */
export function buildCiFiles(
  input: BuildCiFilesInput,
  deps: { readBundle: () => Buffer },
): BuildCiFilesResult {
  let bundle: Buffer;
  try {
    bundle = deps.readBundle();
  } catch {
    throw new BadRequestError(
      `Runner bundle is missing (${BUNDLE_PATH}). Build it with \`cd agent-runner && pnpm build\` before exporting.`,
    );
  }

  const { agent, slug, linkedSkills, triggers, postAs } = input;

  const enabledSkills = linkedSkills
    .filter((link) => link.skill.enabled)
    .map((link) => link.skill);

  assertUniqueSlugs(enabledSkills.map((skill) => ({ id: skill.id, name: skill.name })));

  const skillSlugs = enabledSkills.map((skill) => slugify(skill.name));

  const manifestContents = agentYaml({ agent, skillSlugs });
  const workflowContents = workflowYaml({ slug, triggers, postAs });
  const bundleContents = bundle.toString('utf8');

  const files: CiFile[] = [
    {
      path: resolveSlugTemplate(AGENT_PATH_TEMPLATE, slug),
      contents: manifestContents,
      editable: false,
    },
    ...enabledSkills.map((skill, index) => ({
      path: resolveSlugTemplate(SKILL_PATH_TEMPLATE, skillSlugs[index]!),
      contents: skill.body,
      editable: false,
    })),
    {
      path: MEMORY_PATH,
      contents: '',
      editable: false,
    },
    {
      path: RUNNER_PATH,
      contents: bundleContents,
      editable: false,
    },
    {
      path: resolveSlugTemplate(WORKFLOW_PATH_TEMPLATE, slug),
      contents: workflowContents,
      editable: true,
    },
  ];

  const total_bytes = files.reduce((sum, file) => sum + byteLength(file.contents), 0);

  return { files, total_bytes };
}
