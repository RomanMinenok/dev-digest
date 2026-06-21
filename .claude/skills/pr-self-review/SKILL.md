---
name: pr-self-review
description: "Local PR self-review gate. Run before opening a pull request (or before any `gh pr create` call) to review all changed files against project-specific skill rules. Routes UI files to frontend skills and backend/domain files to backend skills. Blocks the PR if any CRITICAL finding is found. Invoke manually with /pr-self-review."
user-invocable: true
allowed-tools: Bash, Read, Glob, Grep
---

# PR Self-Review

A pre-PR gate that runs project skills against the local diff and blocks on any CRITICAL finding.

---

## Step 1 — Type-check gate

Run `tsc --noEmit` in every touched package before doing anything else.

```bash
# from repo root
cd server && npx tsc --noEmit 2>&1 | head -40
cd ../client && npx tsc --noEmit 2>&1 | head -40
cd ../reviewer-core && npx tsc --noEmit 2>&1 | head -40
```

If TypeScript reports errors, **stop immediately** and output:

```
PR Self-Review — ABORTED
TypeScript errors must be fixed before review can proceed.
<tsc output>
```

Do not continue to skill review — findings on broken types are noise.

---

## Step 2 — Secrets / env leak scan

Before reading any skill, grep the diff for patterns that indicate leaked credentials:

```bash
git diff $(git merge-base HEAD main)...HEAD \
  | grep -E '^\+' \
  | grep -iE '(sk-[a-zA-Z0-9]{20,}|bearer [a-zA-Z0-9\-_.]{20,}|-----BEGIN (RSA|EC|OPENSSH|PGP)|api[_-]?key\s*=\s*"[^"]{8,}|password\s*=\s*"[^"]{6,}|secret\s*=\s*"[^"]{6,})'
```

Any match is an **automatic CRITICAL** — do not continue to skill review, output the offending lines and block.

---

## Step 3 — Collect diff

```bash
BASE=$(git merge-base HEAD main)
git diff $BASE...HEAD --name-only
git diff $BASE...HEAD
```

Collect:
- **Changed file list** (paths only) — used for routing below
- **Diff content** — passed as context to each skill review

---

## Step 4 — Categorise files

Route each changed file to one or more review categories:

| Category | Path pattern |
|---|---|
| **ui** | `client/**/*.{ts,tsx}` |
| **backend** | `server/src/**/*.ts` (excluding `db/schema/` and `db/migrations/`) |
| **schema** | `server/src/db/schema/**/*.ts` |
| **migrations** | `server/src/db/migrations/**` |
| **contracts** | `server/src/vendor/shared/contracts/**/*.ts` |
| **domain** | `reviewer-core/**/*.ts` |

A file can belong to multiple categories (e.g. a `server/src/modules/X/service.ts` is **backend**; a `server/src/db/schema/X.ts` is **schema**).

---

## Step 5 — Run skills per category

For each category that has at least one changed file, run the corresponding skill review against the diff content of those files.

### UI files → run these skills

| Skill | Focus |
|---|---|
| `react-best-practices` | Anti-patterns, hooks misuse, key prop bugs, conditional rendering |
| `react-component-architecture` | Component decomposition, file layout, co-location rules |
| `next-best-practices` | RSC boundaries, `use client` placement, async params, route handlers |
| `security` (frontend section only) | XSS, `dangerouslySetInnerHTML`, client-side auth bypasses |
| `typescript-expert` | `any` usage, missing return types on exported functions, unsafe casts |

### Backend files → run these skills

| Skill | Focus |
|---|---|
| `fastify-best-practices` | Route structure, plugin hygiene, missing schema validation, error handling |
| `onion-architecture` | Layer leakage — Drizzle/infrastructure imported directly into domain/service |
| `zod` | Missing `.safeParse`, incorrect schema shapes, unvalidated input reaching handlers |
| `security` (backend section only) | Injection, OWASP Top 10, broken auth/authz, unvalidated redirects |
| `typescript-expert` | `any` usage, unsafe casts, missing types on public APIs |

### Schema files → run this skill

| Skill | Focus |
|---|---|
| `postgresql-table-design` | Missing indexes, wrong column types, constraint correctness |
| `drizzle-orm-patterns` | Schema definition correctness, relation declarations |

### Domain files → run these skills

| Skill | Focus |
|---|---|
| `onion-architecture` | No infrastructure imports allowed in `reviewer-core/` |
| `typescript-expert` | Type safety, narrowing, `any` |

### Migrations → automatic checks (no skill needed)

For each new migration file:
- Flag if it contains `DROP TABLE`, `DROP COLUMN`, or `ALTER TABLE ... DROP` without a preceding `-- safe:` comment as **WARNING**
- Flag any `TRUNCATE` or `DELETE FROM` without a `WHERE` clause as **CRITICAL**

### Contracts → automatic cross-check

If any file in `server/src/vendor/shared/contracts/` changed:
- Emit a **WARNING**: "Shared contract changed — verify both server handlers and client consumers are updated."
- List the changed contract files.

---

## Step 6 — New component test existence check

For every **newly added** (not modified) file matching `client/**/*.tsx`:
- Check if a corresponding `*.test.tsx` or `*.spec.tsx` exists in the same or `__tests__/` directory
- If not found → emit **WARNING**: "New component `<path>` has no test file."

Detect newly added files:
```bash
git diff $(git merge-base HEAD main)...HEAD --name-status \
  | grep '^A' \
  | awk '{print $2}' \
  | grep 'client/.*\.tsx$'
```

---

## Step 7 — Collect and output findings

Aggregate all findings from Steps 2–6. Each finding must have:
- **Severity**: `CRITICAL` | `WARNING` | `INFO`
- **Skill**: which skill or check produced it
- **File + line** (when available)
- **Description**: one sentence — what the problem is and why it matters

### Output format

```
PR Self-Review — <branch> vs main
Changed files: N  (UI: X  |  Backend: Y  |  Schema: Z  |  Domain: W  |  Other: R)
─────────────────────────────────────────────────────
CRITICAL (N)

  [security]  client/components/Foo.tsx:42
  Raw user input passed to innerHTML — XSS risk.

WARNING (N)

  [contracts]  server/src/vendor/shared/contracts/review.ts
  Shared contract changed — verify both server handlers and client consumers.

  [new-component-test]  client/components/Bar.tsx
  New component has no test file.

INFO (N)

  ...

─────────────────────────────────────────────────────
Result: BLOCKED — N critical finding(s). Fix before opening PR.
```

If no CRITICAL findings:

```
Result: PASSED — ready to open PR.  (N warnings, N info)
```

---

## Step 8 — Exit behaviour

- **Any CRITICAL** → exit with a non-zero signal / block the `gh pr create` call and print the full report
- **Warnings / Info only** → print the report, then allow the `gh pr create` call to proceed
- **Nothing found** → print "PR Self-Review — PASSED. No findings." and proceed

---

## Severity definitions

| Severity | Meaning |
|---|---|
| **CRITICAL** | Security hole, data loss risk, broken contract, or guaranteed runtime crash |
| **WARNING** | Should be addressed; does not block but will cause problems soon |
| **INFO** | Suggestion only; optional improvement |

Only elevate to CRITICAL when you are **confident** the issue is exploitable or will cause a real failure — not for best-practice deviations.
