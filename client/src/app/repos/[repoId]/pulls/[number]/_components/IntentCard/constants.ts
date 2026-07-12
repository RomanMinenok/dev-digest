import type { IconName } from "@devdigest/ui";
import type { IntentSource, RiskSeverity } from "@devdigest/shared";

/** Icon per source type — shown next to each Sources line entry. */
export const SOURCE_ICON: Record<IntentSource["type"], IconName> = {
  pr_body: "MessageSquare",
  linked_issue: "GitBranch",
  repo_md: "FileText",
  pr_md: "FileText",
  external_url: "ExternalLink",
};

/** Colour token per Risk severity — mirrors BlastTab's STATUS_COLOR pattern
    (var(--crit)/var(--warn)/var(--info) scale, not the Finding CRITICAL/HIGH/
    MEDIUM/LOW scale which is a different enum). */
export const RISK_SEVERITY_COLOR: Record<RiskSeverity, string> = {
  high: "var(--crit)",
  medium: "var(--warn)",
  low: "var(--info)",
};

/** `kind` is free-form text from the LLM (not a fixed enum — see
    contracts/brief.ts `Risk.kind: z.string()`), so this is keyword matching
    against a small set of common risk categories rather than a Record lookup.
    Falls back to a generic warning icon for anything unrecognized. */
const RISK_KIND_KEYWORDS: Array<{ icon: IconName; keywords: string[] }> = [
  { icon: "Lock", keywords: ["security", "auth", "vulnerab", "secret", "inject"] },
  { icon: "Gauge", keywords: ["performance", "latency", "slow", "memory", "n+1"] },
  { icon: "Zap", keywords: ["breaking", "compat"] },
  { icon: "Database", keywords: ["data", "migration", "schema"] },
  { icon: "GitMerge", keywords: ["concurren", "race", "deadlock"] },
  { icon: "FlaskConical", keywords: ["test", "coverage"] },
  { icon: "Boxes", keywords: ["dependency", "dependencies", "package"] },
];

/** Maps a free-form Risk.kind string to an icon via keyword match; falls back
    to AlertTriangle for unrecognized kinds. */
export function riskKindIcon(kind: string): IconName {
  const lower = kind.toLowerCase();
  const match = RISK_KIND_KEYWORDS.find((entry) => entry.keywords.some((k) => lower.includes(k)));
  return match ? match.icon : "AlertTriangle";
}
