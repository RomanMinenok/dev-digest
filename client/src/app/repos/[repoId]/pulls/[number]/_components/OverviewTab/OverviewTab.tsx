"use client";

import React from "react";
import { SectionLabel } from "@devdigest/ui";
import { IntentCard } from "../IntentCard";
import { PrBriefCard } from "../PrBriefCard";
import { ReviewFocus } from "../ReviewFocus";
import { usePrBrief } from "../../../../../../../lib/hooks/brief";
import { s } from "./styles";

interface OverviewTabProps {
  prId: string | null | undefined;
  prBody: string | null | undefined;
  repoFullName: string;
  headSha: string;
}

export function OverviewTab({ prId, prBody, repoFullName, headSha }: OverviewTabProps) {
  const { data: brief } = usePrBrief(prId);

  return (
    <>
      <PrBriefCard prId={prId} />

      <IntentCard
        prId={prId}
        risks={brief?.risks?.risks ?? []}
        repoFullName={repoFullName}
        headSha={headSha}
      />

      {prBody && (
        <section>
          <SectionLabel icon="MessageSquare">Description</SectionLabel>
          <div style={s.descriptionBox}>{prBody}</div>
        </section>
      )}

      <ReviewFocus
        reviewFocus={brief?.review_focus ?? []}
        repoFullName={repoFullName}
        headSha={headSha}
      />
    </>
  );
}
