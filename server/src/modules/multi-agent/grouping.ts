import { sameLocation, type FindingLocation } from '../_shared/finding-location.js';
import type { AttributedFinding, LocationGroup } from './types.js';

/**
 * Pure grouping: findings → location groups (SPEC-05 AC-29, AC-30, AC-32).
 *
 * Grouping is **coordinates only**, via `sameLocation` (T-03) — title
 * similarity plays no part. Two same-location findings with completely
 * unrelated titles are deliberately ONE group; this is correct behaviour,
 * not a bug (an earlier spec draft's title-Jaccard rule was rejected because
 * it makes the Divergent filter empty by construction).
 *
 * ## Transitive (union-find) chaining
 *
 * The rule is transitive: if finding A is the "same location" as B, and B is
 * the same location as C, then A, B, and C land in ONE group — even if A and
 * C do not directly satisfy `sameLocation` themselves (e.g. C's widened range
 * only reaches B's, not A's). This is implemented with a union-find
 * (disjoint-set) structure: every pairwise `sameLocation` match unions the
 * two findings' sets, and the final groups are the union-find's connected
 * components. `sameLocation` itself is commutative (see its header proof in
 * `_shared/finding-location.ts`), which is what makes this transitive
 * chaining well-defined — grouping does not depend on which finding is
 * treated as `a` vs `b` in any given comparison.
 *
 * ## Determinism (AC-30)
 *
 * The findings array's incoming order (e.g. repository row order) is NOT
 * guaranteed stable. To guarantee identical output for identical input
 * regardless of arrival order, output is explicitly sorted:
 *   - groups by `(file, minStartLine, minEndLine)`
 *   - findings within a group by `(start_line, end_line, id)`
 * Never rely on `Map`/array insertion order surviving a row-order change.
 */
export function groupByLocation(findings: AttributedFinding[]): LocationGroup[] {
  const n = findings.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  }

  function union(i: number, j: number): void {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  }

  const locations: FindingLocation[] = findings.map((af) => ({
    file: af.finding.file,
    start_line: af.finding.start_line,
    end_line: af.finding.end_line,
  }));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (sameLocation(locations[i]!, locations[j]!)) {
        union(i, j);
      }
    }
  }

  const byRoot = new Map<number, AttributedFinding[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const bucket = byRoot.get(root);
    if (bucket) {
      bucket.push(findings[i]!);
    } else {
      byRoot.set(root, [findings[i]!]);
    }
  }

  const groups: LocationGroup[] = [];
  for (const bucket of byRoot.values()) {
    const sortedFindings = [...bucket].sort((a, b) => {
      if (a.finding.start_line !== b.finding.start_line) {
        return a.finding.start_line - b.finding.start_line;
      }
      if (a.finding.end_line !== b.finding.end_line) {
        return a.finding.end_line - b.finding.end_line;
      }
      return a.finding.id < b.finding.id ? -1 : a.finding.id > b.finding.id ? 1 : 0;
    });

    const minStartLine = Math.min(...sortedFindings.map((af) => af.finding.start_line));
    const minEndLine = Math.min(...sortedFindings.map((af) => af.finding.end_line));

    groups.push({
      file: sortedFindings[0]!.finding.file,
      minStartLine,
      minEndLine,
      findings: sortedFindings,
    });
  }

  groups.sort((a, b) => {
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    if (a.minStartLine !== b.minStartLine) return a.minStartLine - b.minStartLine;
    return a.minEndLine - b.minEndLine;
  });

  return groups;
}
