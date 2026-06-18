#!/usr/bin/env bash
# Stop hook: force the engineering-insights wrap-up at end of session.
# Blocks the stop exactly once (loop-safe via stop_hook_active), then lets
# Claude run the wrap-up and stop normally on the next attempt.
# Contract: https://code.claude.com/docs/en/hooks (Stop event).
set -euo pipefail

input="$(cat)"

# Read stop_hook_active. jq if available, else a tolerant grep fallback.
if command -v jq >/dev/null 2>&1; then
  active="$(printf '%s' "$input" | jq -r '.stop_hook_active // false')"
else
  if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
    active="true"
  else
    active="false"
  fi
fi

# Already continuing from a previous block → allow the stop (prevents a loop).
if [ "$active" = "true" ]; then
  exit 0
fi

# Otherwise block once and tell Claude to run the wrap-up.
reason="Session wrap-up: invoke the engineering-insights skill. Review this \
session — if it was substantive (>30 min, with a problem, decision, or \
discovery), capture the non-obvious lessons into the touched module's \
INSIGHTS.md (server / client / reviewer-core / e2e), one insight per section, \
after the dedup + significance gate, plus one dated Session Notes line. If the \
session was trivial or everything is already recorded, state that nothing is \
worth capturing and stop."

# Emit the block decision as JSON (exit 0). printf keeps the JSON well-formed.
printf '{"decision":"block","reason":%s}\n' "$(
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$reason" | jq -Rs .
  else
    # Minimal JSON-string escaping when jq is absent.
    esc=${reason//\\/\\\\}; esc=${esc//\"/\\\"}; esc=${esc//$'\n'/ }
    printf '"%s"' "$esc"
  fi
)"
exit 0
