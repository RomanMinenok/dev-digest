import type { Container } from '../../platform/container.js';
import type { Skill, SkillSource, SkillStats, SkillType, SkillVersion } from '@devdigest/shared';
import { SkillsRepository } from './repository.js';
import {
  extractFromArchive,
  extractFromMarkdown,
  toSkillDto,
  toSkillVersionDto,
  type ExtractedSkill,
} from './helpers.js';

/**
 * Skills service. Business logic for the Skills Lab — CRUD over `skills`,
 * immutable body versioning via `skill_versions`, usage stats (real `used_by` +
 * placeholders), and stateless import preview (markdown / zip extraction).
 */

// Re-exported for convenience; implementation lives in ./helpers.
export { toSkillDto } from './helpers.js';

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  source?: SkillSource;
  enabled?: boolean;
  summary?: string;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
  summary?: string;
}

export class SkillsService {
  private repo: SkillsRepository;

  constructor(private container: Container) {
    this.repo = new SkillsRepository(container.db);
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    return rows.map(toSkillDto);
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    return row ? toSkillDto(row) : undefined;
  }

  /** Delete a skill (and its versions / agent links, via cascade). */
  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      body: input.body,
      source: input.source ?? 'manual',
      enabled: input.enabled ?? true,
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
    });
    return toSkillDto(row);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkillInput,
  ): Promise<Skill | undefined> {
    const row = await this.repo.update(workspaceId, id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
    });
    return row ? toSkillDto(row) : undefined;
  }

  /**
   * Body history for a skill, newest version first. Workspace-scoped: returns
   * undefined when the skill isn't in this workspace (route → 404) so version
   * snapshots can't be read across tenants.
   */
  async listVersions(workspaceId: string, id: string): Promise<SkillVersion[] | undefined> {
    const skill = await this.repo.getById(workspaceId, id);
    if (!skill) return undefined;
    const rows = await this.repo.listVersions(id);
    return rows.map(toSkillVersionDto);
  }

  /**
   * A single body snapshot. Returns undefined when the skill isn't in this
   * workspace OR that version was never recorded (route → 404).
   */
  async getVersion(
    workspaceId: string,
    id: string,
    version: number,
  ): Promise<SkillVersion | undefined> {
    const skill = await this.repo.getById(workspaceId, id);
    if (!skill) return undefined;
    const row = await this.repo.getVersion(id, version);
    return row ? toSkillVersionDto(row) : undefined;
  }

  /**
   * Restore a past version's body. History is never mutated: we load that
   * version's body and `update` the skill with it, which writes a NEW version on
   * top (with a "Restored v{n}" summary). Returns the updated skill, or
   * undefined when the skill or version is missing (route → 404).
   */
  async restore(workspaceId: string, id: string, version: number): Promise<Skill | undefined> {
    const snapshot = await this.getVersion(workspaceId, id, version);
    if (!snapshot) return undefined;
    return this.update(workspaceId, id, {
      body: snapshot.body,
      summary: `Restored v${version}`,
    });
  }

  /**
   * Usage/quality stats for a skill. `used_by` + `agents` are REAL (derived from
   * agent_skills links); the remaining metrics are honest null placeholders —
   * no finding→skill attribution pipeline exists yet, so we do NOT fabricate
   * them. Workspace-guarded (route → 404 when the skill isn't in the workspace).
   */
  async stats(workspaceId: string, id: string): Promise<SkillStats | undefined> {
    const skill = await this.repo.getById(workspaceId, id);
    if (!skill) return undefined;
    const agents = await this.repo.usedBy(id);
    return {
      skill_id: id,
      used_by: agents.length,
      agents,
      pull_rate: null,
      accept_rate: null,
      findings_30d: null,
      findings_by_category: null,
    };
  }

  /**
   * Preview the skill extracted from an uploaded file. Dispatches on extension:
   * `.zip` → archive extraction (markdown core); everything else is treated as a
   * text/markdown file. Stateless — nothing is persisted.
   */
  importPreview(file: { filename: string; buffer: Buffer }): ExtractedSkill {
    const isZip = file.filename.toLowerCase().endsWith('.zip');
    return isZip
      ? extractFromArchive(file.buffer)
      : extractFromMarkdown(file.buffer.toString('utf8'));
  }
}
