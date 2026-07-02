"use client";

import React from "react";
import { SectionLabel, Button } from "@devdigest/ui";
import { DiffViewer, type DiffCommentApi } from "@/components/diff-viewer";
import { usePrComments, useCreatePrComment, useSmartDiff } from "@/lib/hooks/reviews";
import { notify } from "@/lib/toast";
import { SmartDiffViewer } from "../SmartDiffViewer";
import type { FindingRecord, PrFile } from "@devdigest/shared";

type DiffOrder = "smart" | "original";

interface DiffTabProps {
  prId: string | null;
  filesCount: number;
  files: PrFile[];
  /** Inline commenting is offered only on open PRs (GitHub rejects otherwise). */
  canComment?: boolean;
  /** URL-backed ("?order=") — default "original", so existing links are unaffected. */
  order: DiffOrder;
  onSetOrder: (order: DiffOrder) => void;
  findings: FindingRecord[];
  onFindingClick: (findingId: string) => void;
}

export function DiffTab({
  prId,
  filesCount,
  files,
  canComment,
  order,
  onSetOrder,
  findings,
  onFindingClick,
}: DiffTabProps) {
  const { data: comments } = usePrComments(prId);
  const create = useCreatePrComment(prId);
  // Comments start hidden so the diff is clean by default — toggle to reveal.
  const [showComments, setShowComments] = React.useState(false);
  const { data: smartDiff, isLoading: smartDiffLoading } = useSmartDiff(prId, order === "smart");

  const commentCount = comments?.length ?? 0;

  const commenting: DiffCommentApi = {
    comments: comments ?? [],
    canComment: !!canComment && !!prId,
    showComments,
    posting: create.isPending,
    onSubmit: async (input) => {
      try {
        const res = await create.mutateAsync(input);
        setShowComments(true); // a just-posted comment shouldn't stay hidden
        return res;
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Couldn't post the comment to GitHub.");
        throw err;
      }
    },
  };

  return (
    <section>
      <SectionLabel
        icon="Code"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
              <Button
                kind="ghost"
                size="sm"
                active={order === "smart"}
                onClick={() => onSetOrder("smart")}
              >
                Smart order
              </Button>
              <Button
                kind="ghost"
                size="sm"
                active={order === "original"}
                onClick={() => onSetOrder("original")}
              >
                Original order
              </Button>
            </div>
            {order === "original" && commentCount > 0 && (
              <Button
                kind="ghost"
                size="sm"
                icon={showComments ? "EyeOff" : "Eye"}
                onClick={() => setShowComments((v) => !v)}
              >
                {showComments ? "Hide comments" : "Show comments"} ({commentCount})
              </Button>
            )}
          </div>
        }
      >
        Files changed · {filesCount} files
      </SectionLabel>
      {order === "smart" ? (
        <SmartDiffViewer
          data={smartDiff}
          isLoading={smartDiffLoading}
          files={files}
          findings={findings}
          onFindingClick={onFindingClick}
        />
      ) : (
        <DiffViewer files={files} commenting={commenting} />
      )}
    </section>
  );
}
