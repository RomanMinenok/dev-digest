"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Skeleton, EmptyState, ErrorState } from "@devdigest/ui";
import { AppShell } from "../../../../components/app-shell";
import { RepoNotFound } from "../../../../components/repo-not-found";
import { useActiveRepo } from "../../../../lib/repo-context";
import { useContextDocs } from "../../../../lib/hooks/context-docs";
import { useAgents } from "../../../../lib/hooks/agents";
import { ApiError } from "../../../../lib/api";
import { DocRow } from "./DocRow";
import { s } from "./styles";
import { SKELETON_ROWS } from "./constants";
import { agentsUsingDoc, formatTokenCount } from "./helpers";

/**
 * Project Context list page (SPEC-01, T14). Repo-scoped via `useActiveRepo()`
 * (never `useRepos()[0]` — misses URL/localStorage priority). Single render
 * path: only the inner `content` slot varies across skeleton / no-repo /
 * loading / error / empty / list states — the header chrome always renders
 * (see client/INSIGHTS.md "keep one render path for edge states").
 */
export function ProjectContextView() {
  const t = useTranslations("projectContext");
  const { repoId, reposLoaded } = useActiveRepo();
  const contextDocs = useContextDocs(repoId);
  const agents = useAgents();

  const crumb = [{ label: t("page.crumbLab") }, { label: t("page.crumbTitle") }];

  const docs = contextDocs.data?.docs ?? [];
  const summary = contextDocs.data?.summary;
  const agentList = agents.data ?? [];

  let content: ReactNode;
  if (!reposLoaded || (!!repoId && contextDocs.isLoading)) {
    content = (
      <div style={s.loadingStack}>
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <Skeleton key={i} height={40} />
        ))}
      </div>
    );
  } else if (!repoId) {
    content = <RepoNotFound />;
  } else if (contextDocs.isError) {
    content = (
      <ErrorState
        title={t("page.loadError")}
        body={
          contextDocs.error instanceof ApiError ? contextDocs.error.message : undefined
        }
        onRetry={() => contextDocs.refetch()}
      />
    );
  } else if (docs.length === 0) {
    content = (
      <EmptyState
        icon="Folder"
        title={t("page.empty.title")}
        body={t("page.empty.body")}
      />
    );
  } else {
    content = (
      <>
        <div style={s.list}>
          {docs.map((doc) => (
            <DocRow
              key={doc.path}
              doc={doc}
              usedByAgents={agentsUsingDoc(doc.path, agentList)}
            />
          ))}
        </div>
        <div style={s.footer}>
          <span>
            {t("page.footer.discovered", { count: summary?.total_count ?? docs.length })}
          </span>
          <span>
            {t("page.footer.tokens", {
              count: formatTokenCount(summary?.total_tokens ?? 0),
            })}
          </span>
          <span style={s.footerScanned}>{t("page.footer.scannedNow")}</span>
        </div>
      </>
    );
  }

  return (
    <AppShell crumb={crumb}>
      <div style={s.page}>
        <div style={s.header}>
          <h1 style={s.heading}>{t("page.heading")}</h1>
          <p style={s.subtitle}>{t("page.subtitle")}</p>
        </div>
        <div style={s.body}>{content}</div>
      </div>
    </AppShell>
  );
}
