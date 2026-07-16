/** Constants for the CI export module. */

/** Branch created or updated by export-ci (AC-22). */
export const BRANCH = 'devdigest/ci';

/** Title of the export pull request when none is already open (AC-23). */
export const PR_TITLE = 'Add DevDigest CI review';

/** Token substituted with a slug when resolving path templates. */
export const SLUG_PLACEHOLDER = '<slug>';

/** Per-agent manifest written under the target repo's `.devdigest` tree. */
export const AGENT_PATH_TEMPLATE = `.devdigest/agents/${SLUG_PLACEHOLDER}.yaml`;

/** Per-skill body file; one file per linked, enabled skill (AC-7). */
export const SKILL_PATH_TEMPLATE = `.devdigest/skills/${SLUG_PLACEHOLDER}.md`;

/** Empty memory placeholder committed on first install (AC-8). */
export const MEMORY_PATH = '.devdigest/memory.jsonl';

/** Runner bundle destination inside the target repo (AC-5). */
export const RUNNER_PATH = '.devdigest/runner/index.js';

/** Per-agent GitHub Actions workflow file (AC-5). */
export const WORKFLOW_PATH_TEMPLATE = `.github/workflows/devdigest-review-${SLUG_PLACEHOLDER}.yml`;

/** Artifact JSON filename inside the uploaded zip (AC-21). */
export const RESULT_PATH_TEMPLATE = `devdigest-result-${SLUG_PLACEHOLDER}.json`;

/** GitHub Actions artifact name for ingest (AC-33). */
export const ARTIFACT_NAME_TEMPLATE = `devdigest-result-${SLUG_PLACEHOLDER}`;

/** Repo-relative path to the built runner bundle read at export time (AC-10). */
export const BUNDLE_PATH = 'agent-runner/dist/index.js';

/** Max byte length for a client-submitted workflow override (AC-47). */
export const MAX_WORKFLOW_OVERRIDE_BYTES = 16 * 1024;
