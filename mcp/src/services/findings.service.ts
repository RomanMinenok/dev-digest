import type { DevDigestApiClient, ReviewFindingDto } from '../ports.js';
import type { Resolver } from '../resolver.js';
import type { FindingOut, FindingsPageOut } from '../output-schemas.js';

export interface GetFindingsInput {
  repo: string;
  pr_number: number;
  response_format: 'concise' | 'detailed';
  page: number;
  page_size: number;
}

export function toFindingOut(f: ReviewFindingDto): FindingOut {
  return {
    finding_id: f.id,
    title: f.title,
    severity: f.severity,
    category: f.category,
    file: f.file,
    start_line: f.start_line,
    end_line: f.end_line,
    suggestion: f.suggestion,
    confidence: f.confidence,
  };
}

export function severityCounts(findings: FindingOut[]): string {
  const counts = new Map<string, number>();
  for (const f of findings) counts.set(f.severity, (counts.get(f.severity) ?? 0) + 1);
  return [...counts.entries()].map(([sev, n]) => `${n} ${sev}`).join(', ') || 'none';
}

function shapeForFormat(f: FindingOut, format: 'concise' | 'detailed'): FindingOut {
  if (format === 'detailed') return f;
  return {
    finding_id: f.finding_id,
    title: f.title,
    severity: f.severity,
    category: f.category,
    file: f.file,
    start_line: null,
    end_line: null,
    suggestion: null,
    confidence: null,
  };
}

/** Use case: aggregate findings across all of a PR's reviews, then summary-first paginate. */
export class FindingsService {
  constructor(
    private readonly client: DevDigestApiClient,
    private readonly resolver: Resolver,
  ) {}

  async get(input: GetFindingsInput): Promise<FindingsPageOut> {
    const prId = await this.resolver.resolvePrId(input.repo, input.pr_number);
    const reviews = await this.client.getReviews(prId);
    const reviewFindings = reviews.filter((r) => r.kind === 'review');

    const allFindings = reviewFindings.flatMap((r) => r.findings.map(toFindingOut));
    const verdict = reviewFindings.find((r) => r.verdict !== null)?.verdict ?? null;

    const countsBySeverity: Record<string, number> = {};
    for (const f of allFindings) {
      countsBySeverity[f.severity] = (countsBySeverity[f.severity] ?? 0) + 1;
    }

    const start = (input.page - 1) * input.page_size;
    const pageItems = allFindings
      .slice(start, start + input.page_size)
      .map((f) => shapeForFormat(f, input.response_format));

    return {
      total: allFindings.length,
      counts_by_severity: countsBySeverity,
      page: input.page,
      page_size: input.page_size,
      verdict,
      findings: pageItems,
    };
  }
}
