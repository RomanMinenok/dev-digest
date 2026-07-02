/**
 * Built-in skill bodies (markdown) + metadata used by the seed.
 *
 * Mirrors the style of `./seed-prompts.ts`: each export is the markdown body a
 * reviewing agent receives verbatim (assembled into the prompt's `## Skills /
 * rules` block when the skill is linked AND enabled). The DB row is the source
 * of truth at run time; editing a body here only affects freshly seeded
 * workspaces.
 *
 * The `pr-quality-rubric` skill ships five immutable version snapshots so the
 * Versions tab has real history out of the box — its `body` (the live skill) is
 * `PR_QUALITY_RUBRIC_V5`, and `PR_QUALITY_RUBRIC_VERSIONS` lists v1..v5 with
 * ascending summaries.
 */

import type { SkillSource, SkillType } from '@devdigest/shared';

// =========================================================== pr-quality-rubric

const PR_QUALITY_RUBRIC_V1 = `# PR Quality Rubric

A baseline checklist for reviewing a pull-request diff. Walk each section and
report only concrete, defensible findings.

## Correctness
- Inverted/incorrect conditionals, off-by-one, wrong operator or comparison.
- Async bugs: missing \`await\`, unhandled rejection, \`forEach\` with an async body.

## Security
- Hardcoded secrets, missing authz checks, unsanitised input reaching a sink.

## Tests
- New behaviour shipped without a test; deleted assertions.

## Scope
- Unrelated changes mixed into the diff.`;

const PR_QUALITY_RUBRIC_V2 = `# PR Quality Rubric

A checklist for reviewing a pull-request diff. Walk each section and report only
concrete, defensible findings with an exact file:line.

## Correctness
- Inverted/incorrect conditionals, off-by-one, wrong operator or comparison.
- Async bugs: missing \`await\`, unhandled rejection, \`forEach\` with an async body.
- Truthiness traps: \`[]\`/\`0\`/\`''\` treated as "absent"; \`??\` vs \`||\` confusion.

## Security
- Hardcoded secrets, missing authz checks, unsanitised input reaching a sink.
- Fail-open paths where the code should fail closed.

## Tests
- New behaviour shipped without a test; deleted or weakened assertions.

## Scope
- Unrelated changes mixed into the diff.`;

const PR_QUALITY_RUBRIC_V3 = `# PR Quality Rubric

A checklist for reviewing a pull-request diff. Walk each section and report only
concrete, defensible findings, each citing an exact file:line that exists in the
diff.

## Correctness
- Inverted/incorrect conditionals, off-by-one, wrong operator or comparison.
- Async bugs: missing \`await\`, unhandled rejection, \`forEach\` with an async body.
- Truthiness traps: \`[]\`/\`0\`/\`''\` treated as "absent"; \`??\` vs \`||\` confusion.
- Boundary/empty-collection cases that the change does not handle.

## Security
- Hardcoded secrets, missing authz checks, unsanitised input reaching a sink.
- Fail-open paths where the code should fail closed.
- Missing workspace/tenant scope on a data query.

## Tests
- New behaviour shipped without a test; deleted or weakened assertions.
- Tests that assert on mocks instead of real behaviour.

## Scope
- Unrelated changes mixed into the diff.
- Drive-by refactors that obscure the actual change.`;

const PR_QUALITY_RUBRIC_V4 = `# PR Quality Rubric

A checklist for reviewing a pull-request diff. Walk each section and report only
concrete, defensible findings, each citing an exact file:line that exists in the
diff. State the mechanism — which input triggers the wrong behaviour and what
goes wrong.

## Correctness
- Inverted/incorrect conditionals, off-by-one, wrong operator or comparison.
- Async bugs: missing \`await\`, unhandled rejection, \`forEach\` with an async body,
  race conditions / TOCTOU.
- Truthiness traps: \`[]\`/\`0\`/\`''\` treated as "absent"; \`??\` vs \`||\` confusion.
- Boundary/empty-collection cases that the change does not handle.

## Security
- Hardcoded secrets, missing authz checks, unsanitised input reaching a sink.
- Fail-open paths where the code should fail closed.
- Missing workspace/tenant scope on a data query.

## Tests
- New behaviour shipped without a test; deleted or weakened assertions.
- Tests that assert on mocks instead of real behaviour.
- Flaky patterns: time/order/network dependence without control.

## Scope
- Unrelated changes mixed into the diff.
- Drive-by refactors that obscure the actual change.
- Prefer precision over volume — no style nits without a real defect behind them.`;

const PR_QUALITY_RUBRIC_V5 = `# PR Quality Rubric

A checklist for reviewing a pull-request diff. Walk each section and report only
concrete, defensible findings, each citing an exact file:line that exists in the
diff. State the mechanism — which input triggers the wrong behaviour and what
goes wrong.

## Correctness
- Inverted/incorrect conditionals, off-by-one, wrong operator or comparison.
- Async bugs: missing \`await\`, unhandled rejection, \`forEach\` with an async body,
  race conditions / TOCTOU.
- Truthiness traps: \`[]\`/\`0\`/\`''\` treated as "absent"; \`??\` vs \`||\` confusion.
- Boundary/empty-collection cases that the change does not handle.

## Security
- Hardcoded secrets, missing authz checks, unsanitised input reaching a sink.
- Fail-open paths where the code should fail closed.
- Missing workspace/tenant scope on a data query.

## Tests
- New behaviour shipped without a test; deleted or weakened assertions.
- Tests that assert on mocks instead of real behaviour.
- Flaky patterns: time/order/network dependence without control.

## Scope
- Report ONLY issues introduced or worsened by THIS diff; ignore pre-existing code
  the change does not touch.
- Unrelated changes / drive-by refactors that obscure the actual change.
- Precision over volume: cap output at the **5 highest-signal findings**. If you
  would dismiss a finding as a likely false positive, drop it entirely.`;

/** Live body for the seeded pr-quality-rubric (its head version). */
export const PR_QUALITY_RUBRIC_BODY = PR_QUALITY_RUBRIC_V5;

/** v1..v5 immutable snapshots for pr-quality-rubric, oldest first. */
export const PR_QUALITY_RUBRIC_VERSIONS: ReadonlyArray<{
  version: number;
  summary: string;
  body: string;
}> = [
  { version: 1, summary: 'Initial rubric', body: PR_QUALITY_RUBRIC_V1 },
  { version: 2, summary: 'Added truthiness traps + fail-closed note', body: PR_QUALITY_RUBRIC_V2 },
  {
    version: 3,
    summary: 'Require exact file:line; added tenant-scope and over-mocking checks',
    body: PR_QUALITY_RUBRIC_V3,
  },
  {
    version: 4,
    summary: 'Demand a mechanism per finding; added flaky-test patterns',
    body: PR_QUALITY_RUBRIC_V4,
  },
  {
    version: 5,
    summary: 'Tightened scope rule; cap at 5 high-signal findings',
    body: PR_QUALITY_RUBRIC_V5,
  },
];

// ========================================================= test-coverage-rubric

export const TEST_COVERAGE_RUBRIC_BODY = `# Test Coverage Rubric

Review the test changes (and the tests that *should* have changed) in this diff.
Report concrete gaps, each tied to a specific file:line.

## Uncovered branches
- New conditional/early-return/error path added with no test exercising it.
- Changed behaviour where the existing test still passes against the old logic.

## Missing corner cases
- Empty / null / boundary inputs; the zero-, one-, and many-element cases.
- Error and failure paths (thrown errors, rejected promises, non-2xx responses).

## Over-mocking
- Tests that mock the unit under test, so they assert the mock, not the code.
- Asserting that a stub was called instead of asserting on the observable result.

## Flaky patterns
- Dependence on real time, timers, ordering, or the network without control.
- Shared mutable state between tests; reliance on test execution order.

Approve when the change is adequately covered; otherwise report the specific
untested behaviour and the case that would catch a regression.`;

// =========================================================== api-contract-guard

export const API_CONTRACT_GUARD_BODY = `# API Contract Guard

Detect changes that break an API contract callers depend on. Treat any of the
following as a CRITICAL finding when introduced by this diff.

## Route / signature changes
- A removed or renamed route, method, or path parameter.
- A changed required request field, type, or validation that rejects previously
  valid input.

## Response shape changes
- A removed, renamed, or retyped response field; a changed status code.
- A field that becomes nullable/optional (or stops being so) without versioning.

## Function & module contracts
- A changed exported function signature, return type, or thrown-error contract
  that existing callers in the diff (or known consumers) rely on.
- A Zod/JSON schema edit that tightens or loosens what the endpoint accepts.

## How to judge
- A breaking change is acceptable only when the diff also updates every caller and
  the contract definition together. Flag the mismatch when callers are not updated.
- Backwards-compatible additions (new optional field, new route) are not findings.

Cite the exact file:line of the contract change and name the caller it breaks.`;

// =============================================================== no-then-chains

export const NO_THEN_CHAINS_BODY = `# No .then() Chains

Prefer \`async\`/\`await\` over \`.then()\`/\`.catch()\` promise chains.

## Flag
- \`.then(...)\` / \`.catch(...)\` chains where \`await\` in an \`async\` function would
  read more clearly.
- Nested \`.then()\` callbacks (a "pyramid" of promise continuations).
- Mixing \`await\` and \`.then()\` in the same function.

## Allow
- \`Promise.all\` / \`Promise.race\` / \`Promise.allSettled\` aggregation.
- A single terminal \`.catch()\` on a fire-and-forget call where \`await\` is not used.

> Imported, un-vetted skill. Review before enabling for any agent.`;

// =============================================================== security-rubric

export const SECURITY_RUBRIC_BODY = `# Security Rubric

Review the diff for security defects. Report only concrete, defensible
findings, each citing an exact file:line.

## Secrets & credentials
- Hardcoded API keys, tokens, passwords, or connection strings.
- Secrets logged, echoed in error messages, or committed to fixtures.

## Injection
- Unsanitised input reaching a SQL query, shell command, or template sink.
- SSRF: user-controlled URLs/hosts passed to an outbound request without an
  allowlist.

## AuthZ / AuthN
- Missing or incorrect authorization check on a route or query.
- Missing workspace/tenant scope on a data query.

## Lethal trifecta
- A component with untrusted input, access to sensitive data, AND the ability
  to communicate externally (exfiltration path) — flag even if each piece
  alone looks safe.

Cite the exact file:line and state the exploitable input.`;

// ============================================================ performance-rubric

export const PERFORMANCE_RUBRIC_BODY = `# Performance Rubric

Review the diff for performance regressions. Report only concrete, defensible
findings, each citing an exact file:line.

## N+1 queries
- A query issued inside a loop where a single batched/JOIN query would do.

## Missing indexes
- A new query filtering or sorting on an unindexed column, especially on a
  large or growing table.

## Hot-path allocations
- Unnecessary object/array allocation, JSON parse/stringify, or deep clone
  inside a frequently-called function or request handler.

## Unbounded operations
- Loading an entire table/collection into memory instead of paginating.
- Unbounded loops or recursion driven by user-controlled input.

Cite the exact file:line and state the workload that would trigger the
regression.`;

// ============================================================ seed skill table

export interface SeedSkill {
  name: string;
  description: string;
  type: SkillType;
  source: SkillSource;
  enabled: boolean;
  body: string;
  /** Full version history, oldest first. Omit to seed a single v1 snapshot. */
  versions?: ReadonlyArray<{ version: number; summary: string; body: string }>;
}

/** The skills seeded into the default workspace. */
export const SEED_SKILLS: readonly SeedSkill[] = [
  {
    name: 'pr-quality-rubric',
    description: 'A multi-section rubric for general PR review: correctness, security, tests, scope.',
    type: 'rubric',
    source: 'manual',
    enabled: true,
    body: PR_QUALITY_RUBRIC_BODY,
    versions: PR_QUALITY_RUBRIC_VERSIONS,
  },
  {
    name: 'test-coverage-rubric',
    description: 'Flags uncovered branches, missing corner cases, over-mocking, and flaky patterns.',
    type: 'rubric',
    source: 'manual',
    enabled: true,
    body: TEST_COVERAGE_RUBRIC_BODY,
  },
  {
    name: 'api-contract-guard',
    description: 'Detects route signature changes and other breaking API contract changes.',
    type: 'convention',
    source: 'manual',
    enabled: true,
    body: API_CONTRACT_GUARD_BODY,
  },
  {
    name: 'no-then-chains',
    description: 'Prefer async/await over .then() chains. Imported and not yet vetted.',
    type: 'custom',
    source: 'extracted',
    enabled: false,
    body: NO_THEN_CHAINS_BODY,
  },
  {
    name: 'security-rubric',
    description: 'Flags hardcoded secrets, injection/SSRF, missing authz, and the lethal trifecta.',
    type: 'rubric',
    source: 'manual',
    enabled: true,
    body: SECURITY_RUBRIC_BODY,
  },
  {
    name: 'performance-rubric',
    description: 'Flags N+1 queries, missing indexes, hot-path allocations, and unbounded operations.',
    type: 'rubric',
    source: 'manual',
    enabled: true,
    body: PERFORMANCE_RUBRIC_BODY,
  },
];
