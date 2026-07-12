import { z } from 'zod';

export const RepoArg = z.string().min(1).describe("Repo as 'owner/name' (matched against full_name, falls back to name)");
export const PrNumberArg = z.coerce.number().int().positive().describe('PR number (not the internal uuid)');
export const AgentIdArg = z.string().min(1).describe('agent_id from list_agents — never invent one');

export const ListAgentsInput = z.object({});

export const RunAgentOnPrInput = z.object({
  repo: RepoArg,
  pr_number: PrNumberArg,
  agent_id: AgentIdArg,
});

export const GetFindingsInput = z.object({
  repo: RepoArg,
  pr_number: PrNumberArg,
  response_format: z.enum(['concise', 'detailed']).default('concise'),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(50).default(10),
});

export const GetConventionsInput = z.object({
  repo: RepoArg,
});

export const GetBlastRadiusInput = z.object({
  repo: RepoArg,
  pr_number: PrNumberArg,
});
