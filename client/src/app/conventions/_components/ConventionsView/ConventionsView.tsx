"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon } from "@devdigest/ui";
import { AppShell } from "../../../../components/app-shell";
import { ConventionCard } from "./ConventionCard";
import { MOCK_CONVENTIONS, MOCK_REPO_NAME, MOCK_SAMPLE_COUNT, MOCK_LAST_SCAN } from "./mock";
import { s } from "./styles";

type Status = "accepted" | "rejected";

function initStatuses(): Record<string, Status> {
  return Object.fromEntries(MOCK_CONVENTIONS.map((c) => [c.id, "accepted"]));
}

export function ConventionsView() {
  const t = useTranslations("conventions");

  const [statuses, setStatuses] = React.useState<Record<string, Status>>(initStatuses);

  const acceptedIds = Object.entries(statuses)
    .filter(([, s]) => s === "accepted")
    .map(([id]) => id);
  const acceptedCount = acceptedIds.length;
  const total = MOCK_CONVENTIONS.length;

  const handleAccept = (id: string) =>
    setStatuses((prev) => ({ ...prev, [id]: "accepted" }));

  const handleReject = (id: string) =>
    setStatuses((prev) => ({ ...prev, [id]: "rejected" }));

  const handleDeselectAll = () =>
    setStatuses(Object.fromEntries(MOCK_CONVENTIONS.map((c) => [c.id, "rejected"])));

  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbConventions"), href: "/conventions" },
  ];

  return (
    <AppShell crumb={crumb}>
      <div style={s.page}>
        {/* header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <h1 style={s.heading}>
              {t("page.headingPrefix")}
              <span style={s.headingAccent}>{MOCK_REPO_NAME}</span>
            </h1>
            <p style={s.subtitle}>
              {t("page.detectedFrom", { count: MOCK_SAMPLE_COUNT, ago: MOCK_LAST_SCAN })}
            </p>
          </div>
          <Button kind="secondary" size="sm" icon="RefreshCw">
            {t("page.rescan")}
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
          {MOCK_CONVENTIONS.map((convention) => (
            <ConventionCard
              key={convention.id}
              convention={convention}
              accepted={statuses[convention.id] === "accepted"}
              onAccept={() => handleAccept(convention.id)}
              onReject={() => handleReject(convention.id)}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
