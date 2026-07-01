/* Versions tab — newest-first version history with a Current badge on the head.
   Non-current rows expose a Diff (line-level vs current body) and a Restore
   (writes the old body as a new version). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Modal, Skeleton, ErrorState, EmptyState } from "@devdigest/ui";
import type { Skill, SkillVersion } from "@devdigest/shared";
import {
  useSkillVersions,
  useSkillVersion,
  useRestoreSkillVersion,
} from "../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../lib/toast";
import { diffLines } from "./helpers";
import { s } from "./styles";

function DiffModal({
  skill,
  version,
  onClose,
}: {
  skill: Skill;
  version: number;
  onClose: () => void;
}) {
  const t = useTranslations("skills");
  const { data: old, isLoading } = useSkillVersion(skill.id, version);

  return (
    <Modal
      width={760}
      title={t("versions.diffTitle", { version })}
      subtitle={t("versions.diffSubtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("versions.diffClose")}
          </Button>
        </div>
      }
    >
      <div style={s.diffBody}>
        {isLoading || !old ? (
          <div style={{ padding: 24 }}>
            <Skeleton height={160} />
          </div>
        ) : (
          <div style={{ padding: "12px 0" }}>
            {diffLines(old.body, skill.body).map((line, i) => (
              <div key={i} className="mono" style={s.diffLine(line.kind)}>
                <span style={s.diffGutter(line.kind)}>
                  {line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}
                </span>
                <span>{line.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function VersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const { data: versions, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const restore = useRestoreSkillVersion();
  const [diffVersion, setDiffVersion] = React.useState<number | null>(null);

  if (isLoading) return <Skeleton height={160} />;
  if (isError || !versions) return <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />;

  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const head = sorted[0]?.version;

  const onRestore = (v: SkillVersion) =>
    restore.mutate(
      { id: skill.id, version: v.version },
      { onSuccess: () => toast.success(t("versions.restoredToast", { version: v.version })) },
    );

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <h2 style={s.h2}>
          {t("versions.title")}
          <span style={s.count}>{t("versions.count", { count: sorted.length })}</span>
        </h2>
        <p style={s.sub}>{t("versions.sub")}</p>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon="History" title={t("versions.title")} />
      ) : (
        sorted.map((v) => {
          const isCurrent = v.version === head;
          return (
            <div key={v.version} style={s.row}>
              <div style={s.rowMain}>
                <div style={s.rowTop}>
                  <Badge color="var(--text-secondary)" mono>
                    {t("preview.version", { version: v.version })}
                  </Badge>
                  {isCurrent && (
                    <Badge color="var(--ok)" bg="var(--ok-bg, #052e1c)">
                      {t("versions.current")}
                    </Badge>
                  )}
                </div>
                <div style={s.summary}>{v.summary || t("versions.summaryEmpty")}</div>
                <div style={s.date}>{new Date(v.created_at).toLocaleString()}</div>
              </div>
              {!isCurrent && (
                <div style={s.rowActions}>
                  <Button kind="ghost" size="sm" icon="Eye" onClick={() => setDiffVersion(v.version)}>
                    {t("versions.diff")}
                  </Button>
                  <Button
                    kind="secondary"
                    size="sm"
                    icon="RefreshCw"
                    onClick={() => onRestore(v)}
                    disabled={restore.isPending}
                  >
                    {t("versions.restore")}
                  </Button>
                </div>
              )}
            </div>
          );
        })
      )}

      {diffVersion != null && (
        <DiffModal skill={skill} version={diffVersion} onClose={() => setDiffVersion(null)} />
      )}
    </div>
  );
}
