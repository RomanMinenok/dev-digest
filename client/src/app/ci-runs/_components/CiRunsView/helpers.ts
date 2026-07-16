/** Pure formatting helpers for CI Runs — no React imports. */

/** "2026-05-29T09:14:00.000Z" → "2026-05-29 09:14" (local time, matches mock). */
export function formatRanAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Seconds from `agent_runs.durationMs / 1000`. Null → em dash; real zero → "0.0s". */
export function formatDurationSeconds(durationS: number | null | undefined): string {
  if (durationS == null) return "—";
  return `${durationS.toFixed(1)}s`;
}

/** Human label for the CI provider column. */
export function formatSource(source: string | null | undefined): string {
  if (!source) return "—";
  const lower = source.toLowerCase();
  if (lower.includes("github")) return "GitHub Actions";
  return source;
}
