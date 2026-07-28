/* CiRunsView — /ci-runs container (mock 06, T27).
   Fetches via useCiRuns (T24), owns loading/error/empty + RunTraceDrawer state.
   Single render path: AppShell header + FilterRow always mount; only the table
   area varies by state (see client/INSIGHTS.md ConventionsView lesson). */
"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import type { CiRun } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import RunTraceDrawer from "@/components/run-trace-drawer";
import { useCiRuns } from "@/lib/hooks/ci";
import { useActiveRepo } from "@/lib/repo-context";
import { ApiError } from "@/lib/api";
import { CiRunsTable } from "./_components/CiRunsTable";
import { FilterRow } from "./_components/FilterRow";
import { ciRunsFiltersFromSearch } from "./constants";
import { s } from "./styles";

export function CiRunsView() {
  const t = useTranslations("ci");
  const search = useSearchParams();
  const { activeRepo } = useActiveRepo();

  const filters = React.useMemo(
    () => ciRunsFiltersFromSearch(search, activeRepo?.full_name),
    [search, activeRepo?.full_name],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useCiRuns(filters);
  const runs = data ?? [];

  const [traceRun, setTraceRun] = React.useState<CiRun | null>(null);

  const handleOpenTrace = React.useCallback((run: CiRun) => {
    if (run.run_id) setTraceRun(run);
  }, []);

  const crumb = [{ label: t("page.crumb") }];

  let tableContent: React.ReactNode;
  if (isLoading) {
    tableContent = (
      <div style={s.loadingStack}>
        <Skeleton height={48} />
        <Skeleton height={48} />
        <Skeleton height={48} />
      </div>
    );
  } else if (isError) {
    tableContent = (
      <ErrorState
        body={error instanceof ApiError ? error.message : undefined}
        onRetry={() => refetch()}
      />
    );
  } else if (runs.length === 0) {
    tableContent = (
      <EmptyState icon="GitBranch" title={t("runs.emptyTitle")} body={t("runs.emptyBody")} />
    );
  } else {
    tableContent = <CiRunsTable runs={runs} onOpenTrace={handleOpenTrace} />;
  }

  return (
    <AppShell crumb={crumb}>
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>{t("runs.title")}</h1>
            <p style={s.subtitle}>{t("runs.subtitle")}</p>
          </div>
          <div style={s.headerActions}>
            <Button
              kind="secondary"
              size="sm"
              icon="RefreshCw"
              loading={isFetching && !isLoading}
              onClick={() => refetch()}
            >
              {isFetching && !isLoading ? t("runs.refreshing") : t("runs.refresh")}
            </Button>
          </div>
        </div>

        <FilterRow />

        <div style={s.tableArea}>{tableContent}</div>
      </div>

      {traceRun?.run_id && (
        <RunTraceDrawer
          runId={traceRun.run_id}
          agentName={traceRun.agent}
          prNumber={traceRun.pr_number}
          onClose={() => setTraceRun(null)}
        />
      )}
    </AppShell>
  );
}
