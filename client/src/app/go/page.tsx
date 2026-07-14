"use client";

import { Suspense } from "react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { resolveHandoffTarget } from "../../lib/github-urls";

/**
 * External-link handoff — open a GitHub (or other) URL from a finding, then
 * let the browser land back on the studio PR page via `return`.
 *
 * Query:
 *   next   — primary destination (GitHub blob/PR, or an in-app path)
 *   return — fallback / preferred return path after the external visit
 */
function GoRedirect() {
  const params = useSearchParams();

  useEffect(() => {
    const target = resolveHandoffTarget(params.get("next"), params.get("return"));
    // Full navigation so external https:// targets actually leave the app.
    window.location.href = target;
  }, [params]);

  return (
    <main style={{ padding: 24, fontFamily: "var(--font-sans, system-ui)" }}>
      <p style={{ color: "var(--text-muted)" }}>Opening link…</p>
    </main>
  );
}

export default function GoPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Opening link…</p>}>
      <GoRedirect />
    </Suspense>
  );
}
