#!/usr/bin/env bash
# UserPromptSubmit hook: read-first nudge for the engineering-insights loop.
# Plain stdout is injected as context for the next model call (see
# https://code.claude.com/docs/en/hooks — UserPromptSubmit). Kept trivial to
# stay well under the 30s timeout.
set -euo pipefail

# Eval sessions load this project's settings (hooks included) to grade CLAUDE.md + skills. This
# nudge names the INSIGHTS.md files outright, which is the very routing the workflow evals assert
# CLAUDE.md performs — so under an eval it would grade the hook. Stay out of the way.
if [ -n "${DEVDIGEST_EVAL:-}" ]; then exit 0; fi

cat <<'EOF'
[engineering-insights] Before working this task, read the INSIGHTS.md of the
module(s) it touches and apply the relevant lessons (especially "What Doesn't
Work" and "Recurring Errors & Fixes"):
- server/INSIGHTS.md · client/INSIGHTS.md · reviewer-core/INSIGHTS.md · e2e/INSIGHTS.md
EOF
exit 0
