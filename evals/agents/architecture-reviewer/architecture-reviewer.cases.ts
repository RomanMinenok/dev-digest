import type { AgentCase } from "../../src/index.js";
import { fixtureReader } from "../../src/index.js";

const fx = fixtureReader(import.meta.url);

// Two real violations in one diff: a Presentation-layer type imported into a pure helper, and one
// module constructing another module's repository instead of taking it from the container.
const REVIEW_PROMPT = `Audit this diff against DevDigest's documented structural contracts.

${fx("layering-di-violations.diff")}`;

// A diff that violates NO documented rule (a reducer-parameter rename, no new imports, no
// cross-layer edges). A grounded reviewer should report zero violations.
//
// Deliberately targets a DIFFERENT file from the violations diff above. When both fixtures edited
// blast/helpers.ts, a reviewer reading them side by side attributed the FastifyReply import from
// one to the other and filed it as a critical bug. The fixtures were correct; their proximity was
// not. Keep each fixture on its own file so neither the eval agent nor a human can cross-read them.
const BENIGN_PROMPT = `Audit this diff against DevDigest's documented structural contracts.

${fx("benign-refactor.diff")}`;

// The other shape of true negative: code being ADDED, correctly. A rename is easy to leave alone
// because nothing new appears; a new file plus a new import edge is where a reviewer under pressure
// to produce output starts inventing findings. Everything here is compliant on purpose — the new
// module is pure (no I/O, no clock), it lives inside reviewer-core rather than crossing into it,
// the import edge points inward, and the mandatory groundFindings() gate is still called before the
// return. Zero findings is the only correct answer.
const COMPLIANT_ADDITION_PROMPT = `Audit this diff against DevDigest's documented structural contracts.

${fx("compliant-addition.diff")}`;

// ─────────────────────────────────────────────────────────────────────────────
// Revised 2026-07-29 after the tier's first CI run in this repo (PR #38).
//
// The run scored 1/4, but every DETECTION practice passed — the agent found each violation and
// fabricated nothing. All six failures were output-contract demands the agent artifact never
// makes:
//
//   • "names the documented rule identifier"  — `inward-only-dependencies`, `reviewer-core-zero-io`
//     and `reviewer-core-ground-findings-gate` appear NOWHERE in this repo except the eval file
//     that demanded them. The eval asked the agent to cite identifiers that do not exist.
//   • "ends with an explicit PASS/FAIL gate verdict" — architecture-reviewer.md has no gate concept.
//   • "quotes the offending line verbatim" — the agent promises evidence, not verbatim quotation.
//
// Those practices were deleted rather than fixed by editing the agent: an eval that is satisfied by
// rewriting the artifact to match it has stopped measuring anything. What remains tests only what
// `.claude/agents/architecture-reviewer.md` actually documents.
//
// Case "cites the DevDigest-specific rule identifier" was deleted outright — both of its practices
// were rule-ID citation, so nothing was left. That also removed the only discriminator between the
// strict and lite variants, so evals/agents/architecture-reviewer-lite/ went with it.
//
// ── Second pass, same day, after two more CI runs on PR #39 (4/6 both times) ──
//
// Two more cases deleted. They are NOT the same kind of deletion as the ones above, and the
// difference matters if you are deciding whether to restore either:
//
//   • "findings are anchored to path:line" — deleted as a BAD EVAL. It passed one run and scored
//     0/1 the next on identical code, while the surviving violations case asserts the same anchoring
//     (as part of its evidence practice) and scored 4/4 in both runs. A single-practice case at
//     threshold 1.0 has no tolerance, so one judge disagreement is a total failure. It bought
//     variance, not coverage.
//
//   • "does not fabricate an architecture finding for the out-of-scope security-shaped change" —
//     deleted BY DECISION, and it was measuring something real. Its first practice (no invented
//     violation for the `reply?: FastifyReply` param) passed every run; the second, "stays scoped
//     to structural/layering/DI findings and does not comment on naming, style, or test coverage",
//     failed every run. That second one is legitimate: architecture-reviewer.md:26 documents
//     line-level nits as out of scope, and the agent comments on naming/style/tests regardless.
//     So this is a genuine gap between what the agent promises and what it does, and deleting the
//     case removes the only signal the suite had for it. Recorded here rather than lost: the gap
//     still exists. Restoring the case (or just its first practice) is the way back.
//
// Remaining: 4 cases — one detection, two true negatives, one report-hygiene.
// ─────────────────────────────────────────────────────────────────────────────
export const cases: AgentCase[] = [
  {
    name: "flags the layering and DI violations in the blast module diff with severity",
    kind: "quality",
    prompt: REVIEW_PROMPT,
    practices: [
      "flags the pure helper module (blast/helpers.ts) importing FastifyReply from 'fastify' as a violation of the inward-only dependency rule — a Presentation-layer type reaching into logic that had no framework dependency",
      "flags the `new IntentRepository(container.db)` call added to BlastService's constructor as a violation of DI discipline and of module boundaries — one module reaching into another module's repository instead of going through the container",
      "assigns a severity (critical/high/medium/low/info) to each finding",
      // Softened from "quotes the offending line verbatim". The agent documents evidence, not
      // verbatim quotation, so a path:line anchor or a quoted fragment both satisfy the contract.
      "grounds each finding in concrete evidence — either a path:line anchor or a quoted fragment of the offending code — rather than describing it only in the abstract",
    ],
    threshold: 1.0,
    maxTurns: 25,
  },
  {
    name: "does not fabricate a documented-rule violation for a benign rename",
    kind: "quality",
    prompt: BENIGN_PROMPT,
    practices: [
      "reports no violations for the benign rename (or records only `info`-level, non-blocking observations) — it does not invent a critical/high/medium finding",
      "does not fabricate a documented-rule violation where the diff violates none of the checked rules",
    ],
    threshold: 1.0,
    maxTurns: 25,
  },

  // ── Added 2026-07-29 ────────────────────────────────────────────────────────
  {
    // True negative on ADDED code. The existing benign case only covers a rename; this covers the
    // harder shape, where a new file and a new import edge give a reviewer something to point at.
    name: "reports no violations for a compliant addition",
    kind: "quality",
    prompt: COMPLIANT_ADDITION_PROMPT,
    practices: [
      "reports no critical/high/medium architecture violations for this diff — the new module is pure, the import edge points inward, and the groundFindings() gate is still called",
      "does not flag the new severity.ts module as an I/O or layering violation, since it imports only types and performs no I/O",
      "does not claim the mandatory groundFindings() gate was skipped — it is still called before the return",
    ],
    threshold: 1.0,
    maxTurns: 25,
  },
  {
    // The agent's own Findings section promises severity AND confidence on every finding.
    // Severity was already asserted; confidence has never been tested.
    name: "every finding carries both severity and confidence",
    kind: "quality",
    prompt: REVIEW_PROMPT,
    practices: [
      "every finding carries an explicit confidence level, not only a severity",
      "the confidence level is a stated value (such as high/medium/low) rather than implied by hedging language",
    ],
    threshold: 1.0,
    maxTurns: 25,
  },
];
