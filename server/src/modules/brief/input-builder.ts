import { wrapUntrusted } from '@devdigest/reviewer-core';
import type {
  BlastRadius,
  BlastStatus,
  Intent,
  IssueMeta,
  ReviewRecord,
  SmartDiff,
  SmartDiffRole,
} from '@devdigest/shared';

/**
 * PURE — assembles the LLM input for the PR Brief structured call
 * (SPEC-02-pr-brief). No I/O, no DB/HTTP calls, no `container`. Deterministic
 * given its inputs — same split-out-composition-function pattern as
 * `assembleSmartDiff` in `modules/pulls/service.ts` (see server/INSIGHTS.md).
 *
 * CRITICAL INVARIANT: this function must never accept or reference a full
 * diff/patch body field. Only `SmartDiffGroup`/`SmartDiffFile` — which the
 * `@devdigest/shared` contract already keeps patch-body-free — are read here,
 * and behavior is identical whether `split_suggestion.too_big` is true or
 * false: there is no separate "large PR" code path.
 */

/** A Project Context document already attached to the session's agent(s). */
export interface AttachedDoc {
  path: string;
  content: string;
}

export interface BuildBriefInputParams {
  intent: Intent;
  blast: BlastRadius;
  smartDiff: SmartDiff;
  linkedIssue: IssueMeta | null;
  /** Review DTOs from the latest completed review session (see modules/reviews/helpers.ts `ReviewDto`). */
  latestSessionReviews: ReviewRecord[];
  attachedDocs: AttachedDoc[];
}

/** Compact, count-only view of blast radius — never the full downstream/caller arrays. */
export interface BriefBlastInput {
  summary: string;
  status: BlastStatus;
  changed_symbols_count: number;
  downstream_count: number;
}

/** Group-level Smart Diff stats only — file metadata, never patch bodies. */
export interface BriefSmartDiffFileInput {
  path: string;
  additions: number;
  deletions: number;
  finding_lines_count: number;
}

export interface BriefSmartDiffGroupInput {
  role: SmartDiffRole;
  file_count: number;
  files: BriefSmartDiffFileInput[];
}

export interface BriefSmartDiffInput {
  groups: BriefSmartDiffGroupInput[];
  split_suggestion: {
    too_big: boolean;
    total_lines: number;
    proposed_splits: { name: string; files: string[] }[];
  };
}

/** Structured input handed to the T5 prompt builder. */
export interface BriefLlmInput {
  /** Declared intent, wrapped as untrusted (PR author-controlled text). */
  intent: string;
  blast: BriefBlastInput;
  smartDiff: BriefSmartDiffInput;
  /** Linked issue title + body, wrapped as untrusted; null when there's no linked issue. */
  linkedIssue: string | null;
  /** One wrapped-untrusted block per review in the latest completed session. */
  reviews: string[];
  /** One wrapped-untrusted block per attached Project Context document. */
  attachedDocs: string[];
}

function renderIntentBody(intent: Intent): string {
  const list = (items: string[]) =>
    items.length > 0 ? items.map((i) => `- ${i}`).join('\n') : '- (none specified)';
  return (
    `Intent: ${intent.intent}\n\n` +
    `In scope:\n${list(intent.in_scope)}\n\n` +
    `Out of scope:\n${list(intent.out_of_scope)}`
  );
}

function renderIssueBody(issue: IssueMeta): string {
  const body = issue.body && issue.body.trim().length > 0 ? issue.body.trim() : '(no description)';
  return `Issue #${issue.number} [${issue.state}]: ${issue.title}\n\n${body}`;
}

function renderReviewBody(review: ReviewRecord): string {
  const lines: string[] = [
    `Verdict: ${review.verdict ?? '(none)'}`,
    `Score: ${review.score ?? '(none)'}`,
    `Summary: ${review.summary ?? '(none)'}`,
  ];
  if (review.findings.length > 0) {
    lines.push('Findings:');
    for (const f of review.findings) {
      lines.push(
        `- [${f.severity}/${f.category}] ${f.title} (${f.file}:${f.start_line}-${f.end_line})\n  ${f.rationale}` +
          (f.suggestion ? `\n  Suggestion: ${f.suggestion}` : ''),
      );
    }
  } else {
    lines.push('Findings: (none)');
  }
  return lines.join('\n');
}

function buildBlastInput(blast: BlastRadius): BriefBlastInput {
  return {
    summary: blast.summary,
    status: blast.status,
    changed_symbols_count: blast.changed_symbols.length,
    downstream_count: blast.downstream.length,
  };
}

function buildSmartDiffInput(smartDiff: SmartDiff): BriefSmartDiffInput {
  return {
    groups: smartDiff.groups.map((g) => ({
      role: g.role,
      file_count: g.files.length,
      files: g.files.map((f) => ({
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        finding_lines_count: f.finding_lines.length,
      })),
    })),
    split_suggestion: {
      too_big: smartDiff.split_suggestion.too_big,
      total_lines: smartDiff.split_suggestion.total_lines,
      proposed_splits: smartDiff.split_suggestion.proposed_splits.map((s) => ({
        name: s.name,
        files: s.files,
      })),
    },
  };
}

/**
 * Builds the structured PR Brief LLM input. Always returns the same
 * top-level shape regardless of PR size / `split_suggestion.too_big` — there
 * is no large-PR branch because diff bodies were never part of the input.
 */
export function buildBriefInput(params: BuildBriefInputParams): BriefLlmInput {
  const { intent, blast, smartDiff, linkedIssue, latestSessionReviews, attachedDocs } = params;

  return {
    intent: wrapUntrusted('intent', renderIntentBody(intent)),
    blast: buildBlastInput(blast),
    smartDiff: buildSmartDiffInput(smartDiff),
    linkedIssue: linkedIssue ? wrapUntrusted('linked-issue', renderIssueBody(linkedIssue)) : null,
    reviews: latestSessionReviews.map((r, i) => wrapUntrusted(`review-${i}`, renderReviewBody(r))),
    attachedDocs: attachedDocs.map((d) => wrapUntrusted(`doc:${d.path}`, d.content)),
  };
}
