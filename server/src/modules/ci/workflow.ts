import type { CiExportInput } from '@devdigest/shared';
import {
  ARTIFACT_NAME_TEMPLATE,
  RESULT_PATH_TEMPLATE,
  RUNNER_PATH,
  SLUG_PLACEHOLDER,
} from './constants.js';

export interface WorkflowYamlInput {
  slug: string;
  triggers: readonly string[];
  postAs: CiExportInput['post_as'];
}

function resolveSlug(template: string, slug: string): string {
  return template.replace(SLUG_PLACEHOLDER, slug);
}

function formatTriggerTypes(triggers: readonly string[]): string {
  return triggers.map((trigger) => `      - ${trigger}`).join('\n');
}

/**
 * Pure GitHub Actions workflow emitter (AC-14 through AC-19). One target, one
 * YAML string — no registry or strategy objects. Secrets appear only as
 * `${{ secrets.NAME }}` expressions (AC-44); no credential value is interpolated.
 */
export function workflowYaml(input: WorkflowYamlInput): string {
  const { slug, triggers, postAs } = input;
  const resultPath = resolveSlug(RESULT_PATH_TEMPLATE, slug);
  const artifactName = resolveSlug(ARTIFACT_NAME_TEMPLATE, slug);

  return `name: DevDigest review (${slug})

on:
  pull_request:
    types:
${formatTriggerTypes(triggers)}

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    env:
      OPENROUTER_API_KEY: \${{ secrets.OPENROUTER_API_KEY }}
      GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
      GITHUB_REPOSITORY: \${{ github.repository }}
      PR_NUMBER: \${{ github.event.pull_request.number }}
      DEVDIGEST_POST_AS: ${postAs}
      DEVDIGEST_AGENT: ${slug}
      DEVDIGEST_RESULT_PATH: ${resultPath}
    steps:
      - uses: actions/checkout@v4
      - name: Run DevDigest review
        run: node ${RUNNER_PATH}
      - name: Upload review result
        uses: actions/upload-artifact@v4
        with:
          name: ${artifactName}
          path: ${resultPath}
          if-no-files-found: error
`;
}
