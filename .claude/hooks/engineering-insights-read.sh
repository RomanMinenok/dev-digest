#!/usr/bin/env bash
# UserPromptSubmit hook: read-first nudge for the engineering-insights loop.
# Plain stdout is injected as context for the next model call (see
# https://code.claude.com/docs/en/hooks — UserPromptSubmit). Kept trivial to
# stay well under the 30s timeout.
set -euo pipefail

cat <<'EOF'
[engineering-insights] Before working this task, read the INSIGHTS.md of the
module(s) it touches and apply the relevant lessons (especially "What Doesn't
Work" and "Recurring Errors & Fixes"):
- server/INSIGHTS.md · client/INSIGHTS.md · reviewer-core/INSIGHTS.md · e2e/INSIGHTS.md
EOF
exit 0
