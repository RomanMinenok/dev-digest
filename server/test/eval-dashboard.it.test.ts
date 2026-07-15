import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[eval-dashboard] Docker not available — skipping integration tests.');
}

/**
 * Eval Dashboard routes (SPEC-04, T26) — GET /eval-dashboard and
 * GET /agents/:id/eval-dashboard. All eval runs are inserted directly so the
 * scenarios (version skew, out-of-range runs, agents with/without cases) are
 * fully deterministic and no model is ever exercised.
 */
d('Eval Dashboard routes', () => {
  let pg: PgFixture;
  let workspaceId: string;

  // A single spy stands in for every provider so we can assert AC-33: the
  // dashboard read paths make ZERO model calls.
  const llmSpy = new MockLLMProvider();

  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * DAY);

  // Agent ids populated in beforeAll.
  let agentAlpha = ''; // 3 measured versions (v4/v5/v6), 2 cases
  let agentBeta = ''; // 1 case, never run
  let agentGamma = ''; // no cases at all → invisible on the workspace dashboard
  let agentDelta = ''; // 1 case, runs only OUTSIDE a 30-day range
  let agentOtherWs = ''; // lives in another workspace → 404

  beforeAll(async () => {
    pg = await startPg();
    const seeded = await seed(pg.handle.db);
    workspaceId = seeded.workspaceId;

    const db = pg.handle.db;

    const agentDefaults = {
      workspaceId,
      provider: 'openrouter' as const,
      model: 'deepseek/deepseek-v4-flash',
      systemPrompt: 'Review the diff.',
    };

    const [alpha, beta, gamma, delta] = await db
      .insert(t.agents)
      .values([
        { ...agentDefaults, name: 'L06 Alpha', version: 6 },
        { ...agentDefaults, name: 'L06 Beta', version: 1 },
        { ...agentDefaults, name: 'L06 Gamma', version: 1 },
        { ...agentDefaults, name: 'L06 Delta', version: 2 },
      ])
      .returning();
    agentAlpha = alpha!.id;
    agentBeta = beta!.id;
    agentGamma = gamma!.id;
    agentDelta = delta!.id;

    // Agent in a SECOND workspace — never resolvable through the default context.
    const [otherWs] = await db.insert(t.workspaces).values({ name: 'l06-other' }).returning();
    const [other] = await db
      .insert(t.agents)
      .values({ ...agentDefaults, workspaceId: otherWs!.id, name: 'L06 Other', version: 1 })
      .returning();
    agentOtherWs = other!.id;

    async function addCase(ownerId: string, name: string): Promise<string> {
      const [row] = await db
        .insert(t.evalCases)
        .values({ workspaceId, ownerKind: 'agent', ownerId, name, inputDiff: 'diff', expectedOutput: [] })
        .returning();
      return row!.id;
    }

    interface RunInput {
      agentVersion: number;
      ranAt: Date;
      pass: boolean;
      matched: number;
      expectedTotal: number;
      produced: number;
      falsePositives: number;
      kept: number;
      dropped: number;
      costUsd: number | null;
    }
    async function addRun(caseId: string, r: RunInput) {
      await db.insert(t.evalRuns).values({
        caseId,
        ranAt: r.ranAt,
        pass: r.pass,
        recall: r.expectedTotal === 0 ? 1 : r.matched / r.expectedTotal,
        precision: r.produced === 0 ? 1 : 1 - r.falsePositives / r.produced,
        citationAccuracy: r.kept + r.dropped === 0 ? 1 : r.kept / (r.kept + r.dropped),
        durationMs: 1000,
        costUsd: r.costUsd,
        agentVersion: r.agentVersion,
        matched: r.matched,
        expectedTotal: r.expectedTotal,
        produced: r.produced,
        falsePositives: r.falsePositives,
        kept: r.kept,
        dropped: r.dropped,
      });
    }

    // ── Alpha: two cases, runs at v4 (40d), v5 (20d), v6 (5d). measured = v6. ──
    const a1 = await addCase(agentAlpha, 'alpha-case-1');
    const a2 = await addCase(agentAlpha, 'alpha-case-2');
    await addRun(a1, { agentVersion: 4, ranAt: daysAgo(40), pass: false, matched: 7, expectedTotal: 10, produced: 8, falsePositives: 1, kept: 7, dropped: 3, costUsd: 0.10 });
    await addRun(a1, { agentVersion: 5, ranAt: daysAgo(20), pass: true, matched: 9, expectedTotal: 10, produced: 9, falsePositives: 0, kept: 9, dropped: 1, costUsd: 0.11 });
    await addRun(a1, { agentVersion: 6, ranAt: daysAgo(5), pass: true, matched: 9, expectedTotal: 10, produced: 9, falsePositives: 0, kept: 9, dropped: 1, costUsd: 0.12 });
    await addRun(a2, { agentVersion: 6, ranAt: daysAgo(5), pass: true, matched: 5, expectedTotal: 5, produced: 5, falsePositives: 0, kept: 5, dropped: 0, costUsd: 0.08 });

    // ── Beta: a case with no runs. ──
    await addCase(agentBeta, 'beta-case-1');

    // ── Gamma: NO cases at all. ──

    // ── Delta: one case whose only run is 100 days old (outside a 30d range). ──
    const dl = await addCase(agentDelta, 'delta-case-1');
    await addRun(dl, { agentVersion: 2, ranAt: daysAgo(100), pass: true, matched: 4, expectedTotal: 4, produced: 4, falsePositives: 0, kept: 4, dropped: 0, costUsd: null });
  });

  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        llm: { openai: llmSpy, anthropic: llmSpy, openrouter: llmSpy },
      },
    });
  }

  it('workspace dashboard lists only agents with ≥ 1 case (AC-2)', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/eval-dashboard?days=30' });
    expect(res.statusCode).toBe(200);
    const ids = res.json().agents.map((a: { agent_id: string }) => a.agent_id);
    expect(ids).toContain(agentAlpha);
    expect(ids).toContain(agentBeta); // has a case, never run — still listed (AC-4)
    expect(ids).toContain(agentDelta);
    expect(ids).not.toContain(agentGamma); // no cases → invisible
    // The three seeded built-in agents have no eval cases either.
    expect(ids).toHaveLength(3);
  });

  it('a never-run agent has measured_version null and latest null (AC-4)', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/eval-dashboard?days=30' });
    const beta = res.json().agents.find((a: { agent_id: string }) => a.agent_id === agentBeta);
    expect(beta.measured_version).toBeNull();
    expect(beta.latest).toBeNull();
    expect(beta.sparkline).toEqual([]);
  });

  it('cross-agent version_runs carry snake_case metrics/pass/cost, newest-first (AC-8, AC-9)', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/eval-dashboard?days=90' });
    const runs: Array<Record<string, unknown>> = res.json().version_runs;
    expect(runs.length).toBeGreaterThan(0);

    const first = runs[0]!;
    // Guard the SPEC-03 camelCase-leak bug — keys must be snake_case.
    for (const key of ['agent_id', 'agent_name', 'agent_version', 'ran_at', 'recall', 'precision', 'citation_accuracy', 'cases_passed', 'cases_total', 'cost_usd']) {
      expect(first).toHaveProperty(key);
    }
    // Newest-first by ran_at.
    const times = runs.map((r) => new Date(r.ran_at as string).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('agent dashboard reports the last MEASURED version, trend spanning every version in range (AC-11, AC-18)', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: `/agents/${agentAlpha}/eval-dashboard?days=90` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.measured_version).toBe(6);
    expect(body.current.traces_total).toBe(2); // v6 folded in both cases
    // Runs exist at v4/v5/v6, all within 90 days → three trend points.
    expect(body.trend.map((p: { agent_version: number }) => p.agent_version)).toEqual([4, 5, 6]);
  });

  it('the range filters trend + run list but NOT the metric cards (AC-20, AC-22)', async () => {
    const app = await makeApp();
    // Delta's only run is 100 days old.
    const res = await app.inject({ method: 'GET', url: `/agents/${agentDelta}/eval-dashboard?days=30` });
    const body = res.json();
    expect(body.version_runs).toEqual([]); // range-filtered out
    expect(body.trend).toEqual([]); // range-filtered out
    expect(body.measured_version).toBe(2); // cards still populated
    expect(body.current.traces_total).toBe(1);
    expect(body.cases_total).toBe(1);
  });

  it('validates the days query at the route boundary (AC-21)', async () => {
    const app = await makeApp();
    const ok = await app.inject({ method: 'GET', url: '/eval-dashboard' }); // absent → 30 default
    expect(ok.statusCode).toBe(200);
    // Rejected at the route boundary (zod validation → 422, a 4xx) before any query.
    const bad = await app.inject({ method: 'GET', url: '/eval-dashboard?days=abc' });
    expect(bad.statusCode).toBe(422);
    const outOfRange = await app.inject({ method: 'GET', url: '/eval-dashboard?days=9999' });
    expect(outOfRange.statusCode).toBe(422);
  });

  it('a nonexistent / cross-workspace agent id is 404, not a leak', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: `/agents/${agentOtherWs}/eval-dashboard?days=30` });
    expect(res.statusCode).toBe(404);
  });

  it('makes ZERO model calls across both dashboard routes (AC-33)', async () => {
    const app = await makeApp();
    await app.inject({ method: 'GET', url: '/eval-dashboard?days=30' });
    await app.inject({ method: 'GET', url: `/agents/${agentAlpha}/eval-dashboard?days=90` });
    expect(llmSpy.calls).toHaveLength(0);
  });
});
