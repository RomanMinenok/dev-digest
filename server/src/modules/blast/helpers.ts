import type { BlastCaller, BlastRadius, BlastStatus, ChangedSymbol, DownstreamImpact } from '@devdigest/shared';
import type { BlastResult, IndexState } from '../repo-intel/types.js';

const MAX_CALLERS_PER_SYMBOL = 20;

/**
 * Pure composition: facade `BlastResult` + `IndexState` → the `BlastRadius`
 * HTTP contract. No IO — unit-testable with in-memory fixtures (same split as
 * `assembleSmartDiff`, server/INSIGHTS.md).
 *
 * The persistent facade path already caps callers at 20 GLOBALLY
 * (`repo-intel/service.ts:386`); callers here are a flat list grouped by
 * `viaSymbol`, so the ≤20-per-symbol cap is re-applied per changed symbol.
 */
export function assembleBlast(result: BlastResult, index: IndexState): BlastRadius {
  const changed_symbols: ChangedSymbol[] = result.changedSymbols.map((s) => ({
    name: s.name,
    file: s.file,
    kind: s.kind,
  }));

  const downstream: DownstreamImpact[] = result.changedSymbols.map((sym) => {
    const callers: BlastCaller[] = result.callers
      .filter((c) => c.viaSymbol === sym.name)
      .sort((a, b) => (b.rank - a.rank) || (a.line - b.line))
      .slice(0, MAX_CALLERS_PER_SYMBOL)
      .map((c) => ({ name: c.symbol, file: c.file, line: c.line }));

    const { endpoints, crons } = factsForSymbol(result, callers);

    return {
      symbol: sym.name,
      callers,
      endpoints_affected: endpoints,
      crons_affected: crons,
    };
  });

  return {
    changed_symbols,
    downstream,
    status: blastStatus(index, result),
    summary: '',
  };
}

/** Endpoints/crons for one symbol's callers — prefers `factsByFile`, falls back to the flat degraded list. */
function factsForSymbol(
  result: BlastResult,
  callers: BlastCaller[],
): { endpoints: string[]; crons: string[] } {
  if (result.factsByFile) {
    const endpoints = new Set<string>();
    const crons = new Set<string>();
    for (const caller of callers) {
      const facts = result.factsByFile[caller.file];
      if (!facts) continue;
      for (const e of facts.endpoints) endpoints.add(e);
      for (const c of facts.crons) crons.add(c);
    }
    return { endpoints: [...endpoints], crons: [...crons] };
  }

  // Degraded/ripgrep path: no per-file attribution — flat endpoints, no crons.
  return { endpoints: [...result.impactedEndpoints], crons: [] };
}

/** Full→full, partial→partial, degraded/failed→degraded; forced degraded when the blast read itself degraded. */
export function blastStatus(index: IndexState, result: BlastResult): BlastStatus {
  if (result.degraded) return 'degraded';
  if (index.status === 'full') return 'full';
  if (index.status === 'partial') return 'partial';
  return 'degraded';
}
