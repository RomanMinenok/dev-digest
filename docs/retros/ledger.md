# Workflow Retro Ledger

| Date | Pipeline/Feature | Stages run | Total tokens (in/out/cache-read) | Cache-hit % | Tool-calls | Wall-clock | Parallelism (waves) | Top finding |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-12 | PR Brief (SPEC-02-pr-brief), branch `lesson-05` | spec-creator → implementation-planner → implementer×20 (T1-T17, 3 retries on T8) → plan-verifier → architecture-reviewer | 3,079 / 649,481 / 252,482,457 | 96.7% | 881 | 5.29h (mostly idle waiting on user Q&A + sequential dispatch) | 23 waves, all size-1 (sequential mode, 0 parallelism, by explicit user request) | 8 implementer worktrees independently ran `npm/pnpm install` for missing `reviewer-core`/`server` node_modules — pre-warm or symlink `node_modules` into fresh worktrees instead |
