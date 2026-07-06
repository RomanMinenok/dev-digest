import type { IconName } from "@devdigest/ui";
import type { IntentSource } from "@devdigest/shared";

/** Icon per source type — shown next to each Sources line entry. */
export const SOURCE_ICON: Record<IntentSource["type"], IconName> = {
  pr_body: "MessageSquare",
  linked_issue: "GitBranch",
  repo_md: "FileText",
  pr_md: "FileText",
  external_url: "ExternalLink",
};
