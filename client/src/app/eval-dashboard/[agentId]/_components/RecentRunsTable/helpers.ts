/* Pure formatting helpers for RecentRunsTable — no React imports. */

/** "2026-05-29T09:14:00.000Z" -> "2026-05-29 09:14" (local time, matches mock 02). */
export function formatRanAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
