/* helpers.ts — pure ordering/membership logic for the agent Skills tab.
   Kept I/O-free so it is trivially unit-testable and reusable. */
import type { Skill, AgentSkillLink } from "@devdigest/shared";

/** A skill plus whether it is currently linked to the agent. */
export interface SkillRow {
  skill: Skill;
  linked: boolean;
}

/**
 * Build the displayed row order: linked skills first (in their link order),
 * then every unlinked skill appended (in `skills` order). Links pointing at a
 * skill that no longer exists are silently dropped.
 */
export function buildRows(skills: Skill[], links: AgentSkillLink[]): SkillRow[] {
  const byId = new Map(skills.map((sk) => [sk.id, sk]));
  const ordered = [...links].sort((a, b) => a.order - b.order);
  const linkedIds = new Set(ordered.map((l) => l.skill_id));

  const linkedRows: SkillRow[] = [];
  for (const link of ordered) {
    const skill = byId.get(link.skill_id);
    if (skill) linkedRows.push({ skill, linked: true });
  }
  const unlinkedRows: SkillRow[] = skills
    .filter((sk) => !linkedIds.has(sk.id))
    .map((sk) => ({ skill: sk, linked: false }));

  return [...linkedRows, ...unlinkedRows];
}

/** The ordered ids of the linked skills — the payload sent to the server. */
export function linkedIds(rows: SkillRow[]): string[] {
  return rows.filter((r) => r.linked).map((r) => r.skill.id);
}

/** Toggle a skill's membership, re-grouping so linked rows stay first. */
export function toggleMembership(rows: SkillRow[], skillId: string): SkillRow[] {
  const next = rows.map((r) =>
    r.skill.id === skillId ? { ...r, linked: !r.linked } : r,
  );
  return regroup(next);
}

/**
 * Reorder the LINKED rows by moving the linked row at `from` to `to`. Indices
 * are positions within the linked sub-list (0-based). Unlinked rows are
 * untouched and stay appended after the linked block.
 */
export function reorderLinked(rows: SkillRow[], from: number, to: number): SkillRow[] {
  const linked = rows.filter((r) => r.linked);
  const unlinked = rows.filter((r) => !r.linked);
  if (
    from < 0 ||
    to < 0 ||
    from >= linked.length ||
    to >= linked.length ||
    from === to
  ) {
    return rows;
  }
  const moved = linked.splice(from, 1)[0];
  if (!moved) return rows;
  linked.splice(to, 0, moved);
  return [...linked, ...unlinked];
}

/** Apply a case-insensitive name/description filter (empty query = all). */
export function filterRows(rows: SkillRow[], query: string): SkillRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.skill.name.toLowerCase().includes(q) ||
      r.skill.description.toLowerCase().includes(q),
  );
}

/** Re-group rows so linked ones (in current relative order) precede unlinked. */
function regroup(rows: SkillRow[]): SkillRow[] {
  const linked = rows.filter((r) => r.linked);
  const unlinked = rows.filter((r) => !r.linked);
  return [...linked, ...unlinked];
}
