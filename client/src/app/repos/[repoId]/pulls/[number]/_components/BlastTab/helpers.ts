import type { BlastRadius, DownstreamImpact } from "@devdigest/shared";

export interface BlastRow {
  symbol: string;
  file: string;
  kind: string;
  impact: DownstreamImpact;
}

/** `changed_symbols` and `downstream` are built 1:1 in the same order by the
    server's `assembleBlast` — zip them into rows the tree renders. */
export function blastRows(blast: BlastRadius): BlastRow[] {
  return blast.changed_symbols.map((sym, i) => ({
    symbol: sym.name,
    file: sym.file,
    kind: sym.kind,
    impact: blast.downstream[i] ?? { symbol: sym.name, callers: [], endpoints_affected: [], crons_affected: [] },
  }));
}

export interface BlastCounts {
  symbols: number;
  callers: number;
  endpoints: number;
  crons: number;
}

export function blastCounts(blast: BlastRadius): BlastCounts {
  const callers = blast.downstream.reduce((n, d) => n + d.callers.length, 0);
  const endpoints = new Set(blast.downstream.flatMap((d) => d.endpoints_affected)).size;
  const crons = new Set(blast.downstream.flatMap((d) => d.crons_affected)).size;
  return { symbols: blast.changed_symbols.length, callers, endpoints, crons };
}
