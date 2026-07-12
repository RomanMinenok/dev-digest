import type { BlastRadiusDto, DevDigestApiClient, DownstreamImpactDto } from '../ports.js';
import type { Resolver } from '../resolver.js';
import type { BlastRadiusOut } from '../output-schemas.js';

export interface GetBlastInput {
  repo: string;
  pr_number: number;
}

function toDownstreamOut(d: DownstreamImpactDto): BlastRadiusOut['downstream'][number] {
  return {
    symbol: d.symbol,
    callers: d.callers,
    endpoints: d.endpoints_affected,
    crons: d.crons_affected,
  };
}

export function summaryLine(blast: BlastRadiusDto): string {
  const callers = blast.downstream.reduce((n, d) => n + d.callers.length, 0);
  const endpoints = new Set(blast.downstream.flatMap((d) => d.endpoints_affected)).size;
  const crons = new Set(blast.downstream.flatMap((d) => d.crons_affected)).size;
  return (
    `${blast.status}: ${blast.changed_symbols.length} changed symbols, ${callers} callers, ` +
    `${endpoints} endpoints, ${crons} crons affected` +
    (blast.summary ? ` — ${blast.summary}` : '')
  );
}

/** Use case: fetch a PR's blast radius and map it to the MCP output shape. */
export class BlastService {
  constructor(
    private readonly client: DevDigestApiClient,
    private readonly resolver: Resolver,
  ) {}

  async get(input: GetBlastInput): Promise<{ out: BlastRadiusOut; text: string }> {
    const prId = await this.resolver.resolvePrId(input.repo, input.pr_number);
    const blast = await this.client.getBlast(prId);

    const out: BlastRadiusOut = {
      status: blast.status,
      changed_symbols: blast.changed_symbols,
      downstream: blast.downstream.map(toDownstreamOut),
      summary: blast.summary,
    };

    return { out, text: summaryLine(blast) };
  }
}
