import { pgTable, uuid, text, integer, timestamp, doublePrecision, index } from 'drizzle-orm/pg-core';
import { agents } from './agents';
import { agentRuns } from './runs';

export const ciInstallations = pgTable('ci_installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  repo: text('repo').notNull(),
  targetType: text('target_type', { enum: ['gha', 'circle', 'jenkins', 'cli'] }).notNull(),
  installedAt: timestamp('installed_at', { withTimezone: true }).defaultNow().notNull(),
});

export const ciRuns = pgTable(
  'ci_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ciInstallationId: uuid('ci_installation_id').references(() => ciInstallations.id, {
      onDelete: 'set null',
    }),
    runId: uuid('run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
    prNumber: integer('pr_number'),
    prTitle: text('pr_title'),
    ranAt: timestamp('ran_at', { withTimezone: true }),
    status: text('status'),
    findingsCount: integer('findings_count'),
    critical: integer('critical'),
    warning: integer('warning'),
    suggestion: integer('suggestion'),
    costUsd: doublePrecision('cost_usd'),
    githubUrl: text('github_url'),
    source: text('source'),
  },
  (t) => ({
    runIdIdx: index('ci_runs_run_id_idx').on(t.runId),
    installationGithubUrlIdx: index('ci_runs_ci_installation_id_github_url_idx').on(
      t.ciInstallationId,
      t.githubUrl,
    ),
  }),
);
