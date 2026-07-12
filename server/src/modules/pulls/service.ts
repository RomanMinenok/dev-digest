import type { SmartDiff, SmartDiffFile, SmartDiffGroup, SmartDiffRole } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';
import { ReviewService } from '../reviews/service.js';
import type { ReviewDto } from '../reviews/helpers.js';
import { classifyFile } from './classifier.js';
import { PullsRepository } from './repository.js';
import { selectSessionWindow } from '../_shared/session-window.js';

const SPLIT_LINE_THRESHOLD = 400;
const ROLE_ORDER: SmartDiffRole[] = ['core', 'wiring', 'boilerplate'];
const SPLIT_NAME_BY_ROLE: Record<SmartDiffRole, string> = {
  core: 'Core changes',
  wiring: 'Wiring changes',
  boilerplate: 'Boilerplate changes',
};

export interface SmartDiffPrFile {
  path: string;
  additions: number;
  deletions: number;
}

/**
 * Pure composition: prFiles + reviews (already fetched) → SmartDiff. Kept
 * free of I/O so it can be unit tested without mocking the Drizzle query
 * builder or ReviewService.
 */
export function assembleSmartDiff(prFiles: SmartDiffPrFile[], reviews: ReviewDto[]): SmartDiff {
  // "Findings from the last review" = all reviews in the same session as the
  // most recent one (see `_shared/session-window.ts`) — multiple agents from
  // one "Run Review" click, not just the single newest review.
  const sessionFindings = selectSessionWindow(reviews, (r) => new Date(r.created_at).getTime()).flatMap(
    (r) => r.findings,
  );

  const findingLinesByPath = new Map<string, number[]>();
  for (const finding of sessionFindings) {
    const lines = findingLinesByPath.get(finding.file) ?? [];
    lines.push(finding.start_line);
    findingLinesByPath.set(finding.file, lines);
  }

  const filesByRole: Record<SmartDiffRole, SmartDiffFile[]> = {
    core: [],
    wiring: [],
    boilerplate: [],
  };
  for (const file of prFiles) {
    const role = classifyFile(file.path);
    filesByRole[role].push({
      path: file.path,
      additions: file.additions,
      deletions: file.deletions,
      finding_lines: findingLinesByPath.get(file.path) ?? [],
    });
  }

  const groups: SmartDiffGroup[] = ROLE_ORDER.map((role) => ({
    role,
    files: filesByRole[role],
  }));

  const totalLines = prFiles.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  const tooBig = totalLines > SPLIT_LINE_THRESHOLD;
  const proposedSplits = tooBig
    ? ROLE_ORDER.filter((role) => filesByRole[role].length > 0).map((role) => ({
        name: SPLIT_NAME_BY_ROLE[role],
        files: filesByRole[role].map((f) => f.path),
      }))
    : [];

  return {
    groups,
    split_suggestion: {
      too_big: tooBig,
      total_lines: totalLines,
      proposed_splits: proposedSplits,
    },
  };
}

export class PullsService {
  private repo: PullsRepository;

  constructor(private container: Container) {
    this.repo = new PullsRepository(container.db);
  }

  async smartDiff(workspaceId: string, prId: string): Promise<SmartDiff> {
    const pr = await this.repo.findPr(workspaceId, prId);
    if (!pr) throw new NotFoundError('Pull request not found');

    const prFiles = await this.repo.listPrFiles(pr.id);

    const reviews = await new ReviewService(this.container).reviewsForPull(workspaceId, prId);

    return assembleSmartDiff(prFiles, reviews);
  }
}
