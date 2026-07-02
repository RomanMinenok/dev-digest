# Structured AI PR Reviewer — `GET /pulls/:id/reviews`

## Endpoint

`GET /pulls/:id/reviews` is our own backend endpoint (`server/src/modules/
reviews/routes.ts:129`), part of the `reviews` module. Unlike `GET /pulls/:id`
(see [pull-detail-import.md](./pull-detail-import.md)), it makes **no
external calls** — it only reads what has already been persisted in our own
Postgres tables. It is the source of the findings overlay: "N findings"
badges, line highlighting, and auto-expanded cards. It returns nothing until
the first "Run Review" — before that, the file-tree layout (built from
`prFiles`) works fine, but there is no overlay yet.

## Flow

1. Client calls `GET /pulls/:id/reviews`.
2. `service.reviewsForPull()` (`server/src/modules/reviews/service.ts:160`)
   loads the PR (404 if missing), then asks the repository for every review
   row for that PR plus its findings.
3. `reviewsForPull()` in `server/src/modules/reviews/repository/
   review.repo.ts:58` runs two queries:
   - `SELECT * FROM reviews WHERE pr_id = ? ORDER BY created_at DESC`
   - `SELECT * FROM findings WHERE review_id IN (...)` for all review ids
     from the first query
   Findings are grouped back onto their review in JS (no join).
4. Each review is mapped to a `ReviewDto` (`server/src/modules/reviews/
   helpers.ts:55`): `id`, `agent_id`, `run_id`, `agent_name`, `kind`
   (`summary` | `review`), `verdict`, `summary`, `score`, `model`,
   `created_at`, and its `findings`.
5. Each finding is mapped to a `ReviewDtoFinding` (`helpers.ts:33`) with
   exactly what the UI overlay needs: `severity`, `category`, `title`,
   `file`, `start_line`, `end_line`, `rationale`, `suggestion`,
   `confidence`, `kind`, `trifecta_components`, plus `accepted_at` /
   `dismissed_at` for finding-state UI (accept/dismiss).

## Why there's no overlay before the first Run Review

`reviews` and `findings` rows are only created by `insertReview` /
`insertFindings` (`review.repo.ts:11` and `:29`), which are only invoked
from the review-run pipeline triggered by `POST /pulls/:id/review`. Until
that endpoint has been called at least once for a PR, `reviewsForPull`
returns an empty array — so `GET /pulls/:id/reviews` has nothing to badge,
highlight, or auto-expand. The file-tree layout itself doesn't depend on
this endpoint at all; it's built purely from `prFiles`
(see [pull-detail-import.md](./pull-detail-import.md)).

## Related reads/writes

- `POST /pulls/:id/review` — triggers the run(s) that populate `reviews` /
  `findings` for this endpoint to later serve.
- `POST /findings/:id/(accept|dismiss)` — mutates a finding's
  `accepted_at` / `dismissed_at`, reflected here on the next fetch.
- `DELETE /reviews/:id` — deletes a whole review run and its findings
  (cascade), removing it from this endpoint's output.
