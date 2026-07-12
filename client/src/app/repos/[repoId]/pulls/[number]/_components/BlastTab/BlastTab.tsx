/* BlastTab — the PR's blast radius: which symbols it changed, who calls them,
   and which endpoints/crons are downstream. Loads instantly (summary:''); a
   separate Explain button spends one LLM call for a prose summary.
   Single render path: card chrome (title) is constant, only the inner
   content varies across loading/empty/error/loaded (client/INSIGHTS.md). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Skeleton, SectionLabel } from "@devdigest/ui";
import { useBlast, useExplainBlast } from "../../../../../../../lib/hooks/blast";
import { BlastCard } from "./BlastCard";
import { s } from "./styles";

export function BlastTab({
  prId,
  repoFullName,
  headSha,
}: {
  prId: string | null | undefined;
  repoFullName: string | null;
  headSha: string;
}) {
  const t = useTranslations("prReview");
  const { data: blast, isLoading, isError, refetch } = useBlast(prId);
  const explain = useExplainBlast(prId);

  return (
    <div style={s.wrap}>
      <SectionLabel icon="Workflow">{t("blast.title")}</SectionLabel>

      {isLoading && (
        <div role="status" aria-label={t("blast.loading")} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton height={14} width="60%" />
          <Skeleton height={60} />
          <Skeleton height={60} />
        </div>
      )}

      {!isLoading && isError && (
        <p style={s.emptyBody}>
          {t("blast.error")}{" "}
          <Button kind="ghost" size="sm" onClick={() => refetch()}>
            {t("blast.retry")}
          </Button>
        </p>
      )}

      {!isLoading && !isError && !blast && <p style={s.emptyBody}>{t("blast.empty")}</p>}

      {!isLoading && !isError && blast && (
        <BlastCard
          blast={blast}
          repoFullName={repoFullName}
          headSha={headSha}
          onExplain={() => explain.mutate()}
          explaining={explain.isPending}
        />
      )}
    </div>
  );
}
