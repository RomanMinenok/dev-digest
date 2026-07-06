# PR detail import — `GET /pulls/:id`

## Endpoint

`GET /pulls/:id` is our own backend endpoint
(`server/src/modules/pulls/routes.ts:227`), not a direct call to GitHub from
the client. It wraps and syncs data from GitHub under the hood, and is the
single source `prFiles` (path, additions, deletions, patch) needed for
downstream classification (core/wiring/boilerplate) — no model call required.

## Flow (local-first)

1. Client calls our Fastify server: `GET /pulls/:id`.
2. Server looks up the PR and repo in local Postgres.
3. If a GitHub token is configured, the server calls
   `gh.getPullRequest()` (Octokit-backed, via `container.github()`) to fetch
   fresh files and commits from GitHub.
4. The fetched data **overwrites** the local `prFiles` and `prCommits`
   tables (delete + insert) — GitHub is the source of truth, the local DB is
   a cache.
5. The response is returned as `PrDetail` (typed in `@devdigest/shared`).
6. If GitHub is unavailable (no token / offline), the endpoint does not
   fail — it serves whatever is already persisted locally (seeded or
   previously imported), keeping PR detail usable offline.

## GitHub REST API calls

`gh.getPullRequest()` (`server/src/adapters/github/octokit.ts:70`) makes
three real GitHub REST calls via Octokit, each wrapped in `withRetry` +
`withTimeout`:

1. **`GET /repos/{owner}/{repo}/pulls/{pull_number}`**
   (`octokit.rest.pulls.get`) — core PR data: title, author, branch, base,
   head_sha, additions/deletions, body.
2. **`GET /repos/{owner}/{repo}/pulls/{pull_number}/files`**
   (`octokit.rest.pulls.listFiles`, `per_page: 100`) — changed files with
   path, additions, deletions, and **patch**. This is what becomes `prFiles`.
3. **`GET /repos/{owner}/{repo}/pulls/{pull_number}/commits`**
   (`octokit.rest.pulls.listCommits`, `per_page: 100`) — commit list.

`resolveLinkedIssue()` additionally parses the PR body and makes a further
GitHub API call to resolve a linked issue.

## Known limitation

`listFiles` and `listCommits` are capped at `per_page: 100` with no further
pagination — PRs with more than 100 changed files or commits will be
truncated.
