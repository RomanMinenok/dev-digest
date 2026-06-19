"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Icon, Avatar, Badge, CircularScore } from "@devdigest/ui";
import type { PrMeta } from "@/lib/types";
import type { ReviewRecord } from "@devdigest/shared";
import { api } from "@/lib/api";
import { SIZE_COLOR, STATUS_META } from "../../constants";
import { relativeTime, sizeOf, formatCost } from "../../helpers";
import { s } from "../../styles";
import { SeverityChips } from "../SeverityChips/SeverityChips";

export function PRRow({ pr, repoId }: { pr: PrMeta; repoId: string }) {
  const t = useTranslations("prReview");
  const router = useRouter();
  const [h, setH] = React.useState(false);
  const st = STATUS_META[pr.status] ?? STATUS_META.needs_review!;
  const { size, lines } = sizeOf(pr);
  const reviewed = pr.score != null;
  const hasFindings =
    (pr.critical_count ?? 0) > 0 ||
    (pr.warning_count ?? 0) > 0 ||
    (pr.suggestion_count ?? 0) > 0;

  // Fetch reviews eagerly for PRs that have findings (same pattern as RunHistory).
  // hasFindings limits this to only rows with counts — typically 2-3 per list.
  const { data: reviews } = useQuery({
    queryKey: ["reviews", pr.id],
    queryFn: () => api.get<ReviewRecord[]>(`/pulls/${pr.id}/reviews`),
    enabled: !!pr.id && hasFindings,
    staleTime: 30_000,
  });

  // Take the latest 'review' kind with findings for the popover.
  const popoverFindings = React.useMemo(() => {
    if (!reviews) return [];
    const latest = reviews.find((r) => r.kind === "review" && r.findings.length > 0);
    return latest?.findings ?? [];
  }, [reviews]);

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={() => router.push(`/repos/${repoId}/pulls/${pr.number}`)}
      style={s.row(h)}
    >
      <div style={s.rowTitleCell}>
        <Icon.GitPullRequest size={15} style={s.rowIcon(st.c)} />
        <div style={s.rowTitleWrap}>
          <div style={s.rowTitle(h)}>{pr.title}</div>
          <span className="mono" style={s.rowNumber}>
            #{pr.number}
          </span>
        </div>
      </div>
      <div style={s.authorCell}>
        <Avatar name={pr.author} size={18} />
        {pr.author}
      </div>
      <div>
        <Badge
          color={SIZE_COLOR[size]}
          bg="transparent"
          style={s.sizeBadgeBorder(SIZE_COLOR[size]!)}
        >
          {size} · {lines}
        </Badge>
      </div>
      <div style={s.scoreCell}>
        {reviewed ? (
          <CircularScore score={pr.score!} size={34} stroke={3} />
        ) : (
          <span style={s.muted}>—</span>
        )}
      </div>
      {/* Findings chips — popover managed inside SeverityChips via its own hover state */}
      <div onClick={(e) => e.stopPropagation()}>
        <SeverityChips
          critical={pr.critical_count}
          warning={pr.warning_count}
          suggestion={pr.suggestion_count}
          interactive={hasFindings}
          findings={popoverFindings}
          findingsTotal={popoverFindings.length}
        />
      </div>
      <div>
        <Badge dot color={st.c} bg="transparent">
          {t(`list.status.${st.labelKey}`)}
        </Badge>
      </div>
      <div style={s.costCell}>{formatCost(pr.cost_usd)}</div>
      <div style={s.updatedCell}>{relativeTime(pr.updated_at)}</div>
    </div>
  );
}
