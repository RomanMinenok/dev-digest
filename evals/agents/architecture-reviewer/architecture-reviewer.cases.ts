import type { AgentCase } from "../../src/index.js";
import { fixtureReader } from "../../src/index.js";

const fx = fixtureReader(import.meta.url);

// Two textbook violations planted in the REAL brief module: a Fastify type imported into
// validate.ts (which documents itself as "Pure function: no I/O, no container") and BriefService
// constructing its own BriefRepository instead of taking it from the container. Both files exist,
// so the agent can go and verify — an earlier version of this fixture invented a `checkout` module
// that is nowhere in the repo, and an agent with nothing to ground against padded its report with
// fabricated severity findings (the "does not fabricate" case scored 2/2 → 1/2 → 0/2 across runs).
const REVIEW_PROMPT = `Audit this diff against DevDigest's documented structural contracts.

${fx("brief-layering.diff")}`;

// A second real diff whose violations map onto DevDigest-SPECIFIC contracts that a competent model
// will describe in generic prose ("does file I/O") but will not tie back to the project's own
// documented rule unless the agent forces a citation. This is the discriminating case for the
// strict-vs-lite A/B: both variants should FIND both problems, but only the strict variant (which
// keeps the "cite the documented rule per finding" hard rule) should reliably name the contract.
// The brief-layering diff's textbook violations don't discriminate — the model volunteers the
// inward-only/DI rules either way.
//
// The contracts are cited the way they are actually WRITTEN — reviewer-core/CLAUDE.md:16 ("NO I/O.
// … the only side effect is the injected LLMProvider") and :11 (grounding.ts = citation gate).
// An earlier version of these practices demanded exact slugs (`reviewer-core-zero-io`,
// `reviewer-core-ground-findings-gate`) that exist NOWHERE in the repo — not in CLAUDE.md, not in
// the agent, not in the onion-architecture skill. No agent could pass that, strict or lite, so the
// A/B was measuring an impossibility rather than the citation rule.
const REVIEWER_CORE_PROMPT = `Audit this diff against DevDigest's documented structural contracts.

${fx("reviewer-core-gate.diff")}`;

// A diff that violates NO documented rule (a pure local-variable rename inside a domain file, no
// new imports, no cross-layer edges). A grounded reviewer should report zero violations. This
// surfaces the COST of relaxing the citation rule: freed from "every finding must name a
// documented contract", the lite variant is more prone to fabricating a judgment/best-practice
// finding where the strict variant stays silent.
const BENIGN_PROMPT = `Audit this diff against DevDigest's documented structural contracts.

${fx("benign-refactor.diff")}`;

// Shared across the strict (architecture-reviewer) and relaxed (architecture-reviewer-lite)
// variants so the two agents are graded on the exact same task — the only thing that should
// move between the two runs is whether "cites the specific documented rule" keeps passing.
export const cases: AgentCase[] = [
  {
    name: "flags both violations in the brief-layering diff with severity and a citable rule",
    kind: "quality",
    prompt: REVIEW_PROMPT,
    practices: [
      "flags brief/validate.ts — a file documented as a pure function with no I/O and no container — importing the `FastifyReply` type from 'fastify' as a violation of the inward-only dependency rule between the pure/domain layer and Presentation",
      "flags `new BriefRepository(container.db)` inside BriefService's constructor as a violation of DI discipline (the repository must be taken from the container / composition root, as `container.briefRepo`)",
      "names the documented DevDigest rule each finding breaks (the inward-only dependency rule; construction of concrete repositories belongs in the composition root) rather than describing it only as a generic bad practice",
      "assigns BOTH a severity (Critical/High/Medium/Low/Info) and a confidence level (High/Medium/Low) to each finding",
      "anchors every finding to a concrete `path:line` from the diff as its evidence",
      "ends with a Verdict stating whether the change is architecturally sound",
    ],
    threshold: 1.0,
    maxTurns: 25,
  },
  {
    name: "does not fabricate an architecture finding for the out-of-scope security-shaped change",
    kind: "quality",
    prompt: REVIEW_PROMPT,
    practices: [
      "does not invent an architecture-contract violation for the optional `reply?: FastifyReply` parameter beyond the inward-only dependency import issue itself (no runtime bug, dead-parameter or security finding dressed up as an architecture rule)",
      "stays scoped to structural/layering/DI findings and does not comment on naming, style, or test coverage",
    ],
    threshold: 1.0,
    maxTurns: 25,
  },
  {
    name: "cites the DevDigest-specific rule identifier for reviewer-core violations",
    kind: "quality",
    prompt: REVIEWER_CORE_PROMPT,
    practices: [
      "flags the `import { readFileSync } from 'node:fs'` added to reviewer-core/src/review/run.ts as a violation (reviewer-core must do no I/O except the injected LLMProvider)",
      "flags that runReview now returns the merged findings directly, skipping the mandatory `groundFindings()` citation gate before emitting them",
      "ties the fs-import finding to reviewer-core's documented NO-I/O contract (no DB, GitHub, fs or network; the injected LLMProvider is the only side effect) rather than calling it a generic bad practice",
      "ties the skipped-gate finding to grounding.ts being a mandatory citation gate that findings must pass before they are emitted",
      "anchors every finding to a concrete `path:line` from the diff as its evidence",
      "ends with a Verdict stating whether the change is architecturally sound",
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
      "the Verdict states the change is architecturally sound (no Critical or High findings)",
    ],
    threshold: 1.0,
    maxTurns: 25,
  },
];
