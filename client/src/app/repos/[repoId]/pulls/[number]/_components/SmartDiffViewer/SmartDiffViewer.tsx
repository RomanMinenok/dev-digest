/* SmartDiffViewer — role-grouped ("reviewer-ordered") rendering of a PR's
   changed files: core → wiring → boilerplate. Each file row expands (mirrors
   FileCard's collapse pattern) into the actual diff content, with a severity
   stripe + clickable badge on the exact line a finding lands on. Pure
   client-side composition of the /smart-diff route (role + finding_lines),
   the already-loaded `files` (patch content — SmartDiffFile itself carries
   no patch) and already-fetched findings (see helpers.ts for the file+line
   cross-reference; SmartDiffFile.finding_lines has no severity/id). */
"use client";

import React from "react";
import { Icon, SeverityBadge, Skeleton, EmptyState, type Severity } from "@devdigest/ui";
import type { FindingRecord, PrFile, SmartDiff, SmartDiffFile, SmartDiffRole } from "@devdigest/shared";
import { parsePatch, type Line } from "@/components/diff-viewer/helpers";
import { s as dv, lineRowFor, lineSignFor, chevronFor } from "@/components/diff-viewer/styles";
import { AUTO_EXPAND_MAX_LINES } from "@/components/diff-viewer/constants";
import { ROLE_ORDER, ROLE_TITLE, ROLE_SUBTITLE, ROLE_COLOR } from "./constants";
import { findingForLine } from "./helpers";
import { SEV_COLOR, SEV_COLOR_FALLBACK } from "../FindingCard/constants";
import { s } from "./styles";

function DiffLine({
  ln,
  path,
  findings,
  onFindingClick,
}: {
  ln: Line;
  path: string;
  findings: FindingRecord[];
  onFindingClick: (findingId: string) => void;
}) {
  if (ln.kind === "hunk") {
    return (
      <div className="mono" style={dv.hunk}>
        {ln.text}
      </div>
    );
  }

  const lineNo = ln.newNo ?? ln.oldNo;
  const finding = lineNo != null ? findingForLine(findings, path, lineNo) : undefined;
  const stripeColor = finding ? SEV_COLOR[finding.severity] ?? SEV_COLOR_FALLBACK : null;
  const sign = ln.kind === "add" ? "+" : ln.kind === "del" ? "−" : "";

  return (
    <div style={s.codeLineWrap(stripeColor)}>
      <div style={lineRowFor(ln.kind)}>
        <span className="mono tnum" style={dv.lineNo}>
          {lineNo ?? ""}
        </span>
        <span className="mono" style={lineSignFor(ln.kind)}>
          {sign}
        </span>
        <span className="mono" style={dv.lineText}>
          {ln.text || " "}
        </span>
        {finding && lineNo === finding.start_line && (
          <button
            style={s.findingBadgeButton}
            onClick={() => onFindingClick(finding.id)}
            aria-label={`Open finding: ${finding.title}`}
          >
            <SeverityBadge severity={finding.severity as Severity} compact />
          </button>
        )}
      </div>
    </div>
  );
}

function FileRow({
  file,
  patch,
  findings,
  onFindingClick,
}: {
  file: SmartDiffFile;
  patch: string | null | undefined;
  findings: FindingRecord[];
  onFindingClick: (findingId: string) => void;
}) {
  const [open, setOpen] = React.useState(file.additions + file.deletions <= AUTO_EXPAND_MAX_LINES);
  const lines = React.useMemo(() => parsePatch(patch), [patch]);
  const hasFindings = file.finding_lines.length > 0;

  return (
    <div style={s.fileCard}>
      <div style={s.fileHeader} onClick={() => setOpen((o) => !o)}>
        <Icon.ChevronRight size={13} style={chevronFor(open)} />
        <span className="mono" style={s.filePath}>
          {file.path}
        </span>
        <span className="mono tnum" style={s.fileStat}>
          <span style={s.addText}>+{file.additions}</span> <span style={s.delText}>−{file.deletions}</span>
        </span>
        {hasFindings && <span style={s.findingDot} title="Has findings" />}
      </div>
      {open &&
        (lines.length === 0 ? (
          <div style={dv.noDiff}>No diff available for this file.</div>
        ) : (
          <div style={s.fileBody}>
            {lines.map((ln, i) => (
              <DiffLine key={i} ln={ln} path={file.path} findings={findings} onFindingClick={onFindingClick} />
            ))}
          </div>
        ))}
    </div>
  );
}

function RoleSection({
  role,
  files,
  patchByPath,
  findings,
  onFindingClick,
}: {
  role: SmartDiffRole;
  files: SmartDiffFile[];
  patchByPath: Map<string, string | null | undefined>;
  findings: FindingRecord[];
  onFindingClick: (findingId: string) => void;
}) {
  const [open, setOpen] = React.useState(role !== "boilerplate");

  return (
    <div style={s.section}>
      <div style={s.roleHeader} onClick={() => setOpen((o) => !o)}>
        <span style={s.roleSwatch(ROLE_COLOR[role])} />
        <div>
          <div style={s.roleTitle}>{ROLE_TITLE[role]}</div>
          <div style={s.roleSubtitle}>{ROLE_SUBTITLE[role]}</div>
        </div>
        <span style={s.roleCount}>
          {files.length} file{files.length === 1 ? "" : "s"}
        </span>
        <Icon.ChevronDown size={16} style={s.roleChevron(open)} />
      </div>
      {open &&
        (files.length === 0 ? (
          <div style={s.emptyRole}>No files in this group.</div>
        ) : (
          files.map((f) => (
            <FileRow
              key={f.path}
              file={f}
              patch={patchByPath.get(f.path)}
              findings={findings}
              onFindingClick={onFindingClick}
            />
          ))
        ))}
    </div>
  );
}

export function SmartDiffViewer({
  data,
  isLoading,
  files,
  findings,
  onFindingClick,
}: {
  data: SmartDiff | undefined;
  isLoading: boolean;
  files: PrFile[];
  findings: FindingRecord[];
  onFindingClick: (findingId: string) => void;
}) {
  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Skeleton height={60} />
        <Skeleton height={60} />
        <Skeleton height={60} />
      </div>
    );
  }

  if (!data) {
    return <EmptyState icon="GitPullRequest" title="Smart Diff unavailable" body="Couldn't load the reviewer-ordered diff for this PR." />;
  }

  const filesByRole = new Map(data.groups.map((g) => [g.role, g.files]));
  const patchByPath = new Map(files.map((f) => [f.path, f.patch]));

  return (
    <div>
      {data.split_suggestion.too_big && (
        <div style={s.splitBanner}>
          <Icon.Layers size={14} />
          This PR is large ({data.split_suggestion.total_lines} lines changed) — consider splitting it into{" "}
          {data.split_suggestion.proposed_splits.length} smaller PR
          {data.split_suggestion.proposed_splits.length === 1 ? "" : "s"}.
        </div>
      )}
      {ROLE_ORDER.map((role) => (
        <RoleSection
          key={role}
          role={role}
          files={filesByRole.get(role) ?? []}
          patchByPath={patchByPath}
          findings={findings}
          onFindingClick={onFindingClick}
        />
      ))}
    </div>
  );
}
