/** PR event triggers for the Configure step (AC-11). */
export const TRIGGER_OPTIONS = [
  { id: "opened", label: "pull_request:opened" },
  { id: "synchronize", label: "pull_request:synchronize" },
  { id: "reopened", label: "pull_request:reopened" },
] as const;

export type TriggerId = (typeof TRIGGER_OPTIONS)[number]["id"];

/** Static expected-secret rows — explanatory only, never fetched (AC-12). */
export const EXPECTED_SECRETS = [
  {
    name: "OPENROUTER_API_KEY",
    descriptionKey: "openRouterDesc",
    status: "not_set",
  },
  {
    name: "GITHUB_TOKEN",
    descriptionKey: "githubTokenDesc",
    status: "ready",
  },
] as const;

export type ExpectedSecretStatus = (typeof EXPECTED_SECRETS)[number]["status"];

export const POST_AS_OPTIONS = [
  { id: "github_review", labelKey: "githubReview", recommended: true },
  { id: "pr_comment", labelKey: "prComment" },
  { id: "none", labelKey: "none" },
] as const;

export type PostAsId = (typeof POST_AS_OPTIONS)[number]["id"];
