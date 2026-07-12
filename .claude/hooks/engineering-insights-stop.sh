#!/usr/bin/env bash
# Stop hook: trigger the engineering-insights wrap-up when relevant.
#
# Logic:
#   1. If stop_hook_active=true (Claude Code) or loop_count>0 (Cursor) →
#      already continuing from a block/follow-up, allow stop.
#   2. If source files were changed (uncommitted changes or recent commits) →
#      full wrap-up prompt.
#   3. If no source changes but session may have had a dead end (faulty code
#      that was reverted) → lightweight dead-end-only prompt.
#   4. If purely planning/spec/conversation → exit 0, no block.
#
# "Source files" excludes INSIGHTS.md, MEMORY.md, and .claude/ meta files so
# the insights write itself does not re-trigger the hook.
set -euo pipefail

input="$(cat)"
PROJ_DIR="${CLAUDE_PROJECT_DIR:-.}"

# ── Loop guard ────────────────────────────────────────────────────────────────
# Claude Code: stop_hook_active. Cursor: loop_count (maps decision:block → followup).
if command -v jq >/dev/null 2>&1; then
  active="$(printf '%s' "$input" | jq -r '.stop_hook_active // false')"
  loop_count="$(printf '%s' "$input" | jq -r '.loop_count // 0')"
else
  if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
    active="true"
  else
    active="false"
  fi
  loop_count="$(printf '%s' "$input" | sed -n 's/.*"loop_count"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p')"
  loop_count="${loop_count:-0}"
fi

if [ "$active" = "true" ] || [ "$loop_count" -gt 0 ]; then
  exit 0
fi

# ── Detect source-file changes ────────────────────────────────────────────────
# Uncommitted changes (staged or unstaged), excluding meta files.
has_uncommitted=$(git -C "$PROJ_DIR" status --porcelain 2>/dev/null \
  | grep -v 'INSIGHTS\.md' \
  | grep -v 'MEMORY\.md' \
  | grep -vE '^.. \.claude/' \
  | grep -c '' || true)

# Commits to source modules in the last 3 hours (covers rebased/amended work).
has_recent_commits=$(git -C "$PROJ_DIR" log --oneline --since="3 hours ago" \
  -- 'server/*' 'client/*' 'reviewer-core/*' 'e2e/*' 'scripts/*' 2>/dev/null \
  | grep -c '' || true)

# ── Choose prompt ─────────────────────────────────────────────────────────────
if [ "$has_uncommitted" -gt 0 ] || [ "$has_recent_commits" -gt 0 ]; then
  # Source files changed → full wrap-up.
  reason="Session wrap-up: invoke the engineering-insights skill. Review this \
session — if it was substantive (>30 min, with a problem, decision, or \
discovery), capture the non-obvious lessons into the touched module's \
INSIGHTS.md (server / client / reviewer-core / e2e), one insight per section, \
after the dedup + significance gate, plus one dated Session Notes line. If the \
session was trivial or everything is already recorded, state that nothing is \
worth capturing and stop."
else
  # No source changes → nothing to capture, exit silently.
  exit 0
fi

# ── Emit block ────────────────────────────────────────────────────────────────
printf '{"decision":"block","reason":%s}\n' "$(
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$reason" | jq -Rs .
  else
    esc=${reason//\\/\\\\}; esc=${esc//\"/\\\"}; esc=${esc//$'\n'/ }
    printf '"%s"' "$esc"
  fi
)"
exit 0
