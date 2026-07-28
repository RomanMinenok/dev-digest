import { stringify } from 'yaml';
import { AgentManifest } from '@devdigest/shared';
import type { AgentRow } from '../../db/rows.js';

/**
 * Pure agent-manifest YAML emitter (AC-6). The runner validates the same shape
 * via `AgentManifest` in `agent-runner/src/manifest.ts` — parse before stringify
 * so malformed configs fail at export time, not in CI.
 */
export function agentYaml(input: { agent: AgentRow; skillSlugs: string[] }): string {
  const { agent, skillSlugs } = input;

  const manifest = AgentManifest.parse({
    name: agent.name,
    provider: agent.provider,
    model: agent.model,
    system_prompt: agent.systemPrompt,
    skills: skillSlugs,
    strategy: agent.strategy,
    ci_fail_on: agent.ciFailOn,
  });

  return stringify(manifest);
}
