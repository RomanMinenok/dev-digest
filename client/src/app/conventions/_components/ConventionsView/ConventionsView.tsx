"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon } from "@devdigest/ui";
import { AppShell } from "../../../../components/app-shell";
import { ConventionCard } from "./ConventionCard";
import { s } from "./styles";
import { useActiveRepo } from "../../../../lib/repo-context";
import { useConventions, useRescanConventions } from "../../../../lib/hooks/conventions";
import type { ConventionCandidate } from "@devdigest/shared";
import type { Convention } from "./mock";

type Status = "accepted" | "rejected";

function toConvention(c: ConventionCandidate): Convention {
  return {
    id: c.id,
    title: c.rule,
    file: c.evidence_path,
    code: c.evidence_snippet,
    confidence: Math.round(c.confidence * 100),
  };
}

export function ConventionsView() {
  const t = useTranslations("conventions");
  const { repoId, activeRepo } = useActiveRepo();
  const conventions = useConventions(repoId);
  const rescan = useRescanConventions(repoId);

  const candidates = conventions.data ?? [];
  const cards = candidates.map(toConvention);

  const [statuses, setStatuses] = React.useState<Record<string, Status>>({});

  React.useEffect(() => {
    setStatuses(Object.fromEntries(candidates.map((c) => [c.id, "accepted" as Status])));
  }, [candidates]);

  const acceptedCount = Object.values(statuses).filter((s) => s === "accepted").length;
  const total = cards.length;

  const handleAccept = (id: string) =>
    setStatuses((prev) => ({ ...prev, [id]: "accepted" }));

  const handleReject = (id: string) =>
    setStatuses((prev) => ({ ...prev, [id]: "rejected" }));

  const handleDeselectAll = () =>
    setStatuses(Object.fromEntries(cards.map((c) => [c.id, "rejected" as Status])));

  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbConventions"), href: "/conventions" },
  ];

  const repoName = activeRepo?.full_name ?? t("page.repoFallback");

  return (
    <AppShell crumb={crumb}>
      <div style={s.page}>
        {/* header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <h1 style={s.heading}>
              {t("page.headingPrefix")}
              <span style={s.headingAccent}>{repoName}</span>
            </h1>
            {cards.length > 0 && (
              <p style={s.subtitle}>
                {t("page.detectedFrom", { count: candidates.length, ago: "—" })}
              </p>
            )}
          </div>
          <Button
            kind="secondary"
            size="sm"
            icon="RefreshCw"
            loading={rescan.isPending}
            onClick={() => rescan.mutate()}
          >
            {rescan.isPending ? t("page.scanning") : t("page.rescan")}
          </Button>
        </div>

        {/* toolbar */}
        <div style={s.toolbar}>
          <div style={s.toolbarLeft}>
            <button style={s.deselectBtn} onClick={handleDeselectAll}>
              <Icon.X size={12} />
              {t("page.deselectAll")}
            </button>
            <span style={s.acceptedLabel}>
              {t("page.acceptedOf", { accepted: acceptedCount, total })}
            </span>
          </div>
          <Button kind="primary" size="sm" icon="Plus" disabled={acceptedCount === 0}>
            {t("page.createSkill")}
          </Button>
        </div>

        {/* convention cards */}
        <div style={s.list}>
          {cards.map((card) => (
            <ConventionCard
              key={card.id}
              convention={card}
              accepted={statuses[card.id] === "accepted"}
              onAccept={() => handleAccept(card.id)}
              onReject={() => handleReject(card.id)}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
