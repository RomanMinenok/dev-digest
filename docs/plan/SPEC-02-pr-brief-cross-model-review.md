# PR Brief Implementation Plan Review (Staff Engineer by Gemini Pro)

**Status:** Pre-implementation Review
**Spec:** `specs/SPEC-02-pr-brief.md`
**Plan:** `docs/plan/pr-brief-implementation-plan.md`

## 🏆 Architectural Strengths (The "Good")

1. **Clean Onion Architecture**: The separation of pure business logic (`input-builder.ts`, `validate.ts`) from side effects (`repository.ts`, Fastify routes) is excellent. This design will make the core LLM prompt assembly and validation highly testable.
2. **Strict Cost Controls**: The explicit commitment to "no diff bodies ever" in the input builder perfectly aligns with the spec's mandate (AC-9, AC-12) to control token spend, especially for large PRs.
3. **Anti-Hallucination Gate**: Introducing a dedicated `validate.ts` step to filter out fabricated `file_refs` and `review_focus` paths (AC-13) before persisting them to the DB is a great defensive practice. 

## ⚠️ Risks & Required Changes (The "Needs Work")

Before proceeding with execution, the following adjustments must be made to the implementation plan:

### 1. Testing Cannot Be Deferred (Critical)
The plan currently defers all testing. However, the Specification (AC-1 through AC-23) explicitly mandates Unit, Integration, and RTL component tests. Given the non-deterministic nature of LLMs and the complexity of the data transformations, we cannot merge this core feature without test coverage.
**Action Item:** Add specific tasks to the plan for:
- **Unit tests:** `input-builder.ts` (ensuring no diff bodies leak in) and `validate.ts` (hallucination filtering).
- **Integration tests:** `service.ts` caching and recompute behavior (AC-4 to AC-8).

### 2. Drizzle Type Safety (Tech Debt Prevention)
The plan notes that the `pr_brief.json` column will be an untyped `jsonb`, forcing a manual type cast at the read boundary. We should not intentionally introduce this tech debt.
**Action Item:** Update Task T2 to define a strongly typed custom JSON column in Drizzle (e.g., using `.type<PrBrief>()` or `$type<PrBrief>()`) so the ORM enforces the contract automatically.

### 3. Model Selection Risk (T3)
Task T3 proposes setting the default model to `openrouter/deepseek/deepseek-v4-flash`. While this is cost-effective, we need to be absolutely certain this model consistently adheres to complex structured JSON schemas (`BriefResult`). 
**Action Item:** Verify its strict JSON-mode reliability for this specific schema during development. If it fails frequently, be prepared to fall back to a more capable model (like GPT-4o or Claude 3.5 Sonnet).

### 4. UI Verification (Blind Flight)
The plan explicitly defers live browser verification, relying only on `typecheck` and `build`. For a feature introducing new cards, complex empty states, and GitHub deep-links (`githubBlobUrl`), this is insufficient.
**Action Item:** Do not defer manual visual verification. The implementer must test the UI locally against edge cases (e.g., no completed reviews, no risk areas, no review focus) to ensure the newly added i18n keys and layouts render correctly before merging.

## Conclusion
The architectural foundation is rock solid, but the execution plan needs to be adjusted to include testing and proper database type safety from the start. Please update the plan to incorporate these action items before beginning the execution phase.
