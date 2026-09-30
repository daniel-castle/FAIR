# Benchmark query demo setup

Truth Hub read access was verified: one business, two offerings, three facts. No additional read policies were needed. The benchmark_queries table was not present.

1. Run `supabase/migrations/202609300001_benchmark_queries.sql` in the connected project's SQL Editor. It creates the generic query table and idempotent SELECT/INSERT policies scoped to the earliest seeded business. It does not modify business, offering, fact, or source policies. The public policies are temporary competition-demo access, not production security.
2. Add `OPENAI_API_KEY=...` to `.env.local` (server-only; never use a NEXT_PUBLIC prefix). Generation is pinned to `gpt-5.6-luna`; environment variables cannot override the model. Restart the Next.js server after changing environment variables.
3. Open `/queries`, apply the remaining migrations below, click **Refresh Questions**, and confirm a batch of 15 definitions is created. Reload to verify persistence.

Generation uses one OpenAI Responses API request with SDK retries disabled, structured JSON, and Zod validation. It reads the current demo business, industry, location, offerings, and only verified facts. The Truth Hub template selector is a visit-only preference; generation uses the stored industry and a verified `business_template` fact if one exists. No monitoring is performed.

Reference: https://developers.openai.com/api/docs/guides/structured-outputs

If generation fails, the page displays an error. Refused, incomplete, invalid, or duplicate-containing batches are not saved. Save errors do not masquerade as success. A successful bulk insert is read back before reporting success.

The server action is unauthenticated for this demo. Do not expose the paid generation endpoint as a production feature without authorization and cost controls. Remove the two demo policies before production and replace them with tenant-aware access.

## Query organization and metrics

Run `supabase/migrations/202609300003_query_metrics.sql` after the first two migrations. It adds `location`, `is_active`, and `updated_at` to benchmark query definitions, plus a separate `query_results` table for monitoring history. It also adds temporary demo SELECT/INSERT/UPDATE policies scoped to the earliest seeded business.

The Queries page can then create manual benchmark queries, pause or activate them, filter the library, and display result history. The migration does not seed fake results. Until result rows exist, the page shows “No AI scans have been run yet.” The Run AI Scan button is disabled.

Metrics are computed in `src/lib/queries/metrics.ts` by the server loader from the latest stored result per query (including inactive queries):

- Mention Rate = mentioned results / all tested results.
- Average Position = average position among mentioned results with a recorded position.
- Fact Accuracy = total verified claims / total claims checked; no checked claims means unavailable.
- Top Recommendation Rate = first-position mentions / tested queries.
- Test Coverage = tested queries / all saved queries; no results means unavailable.

The current public demo policies are not a production authorization model. Replace them with tenant-aware authenticated policies before using real customer data.

## Internal query analysis compatibility

Run `supabase/migrations/202609300002_query_analysis.sql` to add a nullable `analysis` JSON column and column-scoped demo UPDATE access. Existing generation and query rows remain usable before this migration.

The optional analysis column and parser remain for backward compatibility and developer investigation, but they are not part of the normal Queries experience. Benchmark generation already produces the authoritative category, audience, purpose, evaluation dimensions, and canonical-fact suggestions in one request. Do not add a second user-facing analysis step.

Unspecified metadata remains null or an empty list. Analysis describes requested evidence, not verified business truth or an AI monitoring result. The existing benchmark generator still produces only 10–15 queries per manual invocation. Errors appear in the server terminal under `Benchmark query analysis failed:` with redacted diagnostics.


## Benchmark definitions, provenance, and canonical truth

Apply `supabase/migrations/202609300004_benchmark_definitions.sql` after migrations 001–003. No existing queries or analyses are deleted or rewritten. Historical origin remains NULL (“Origin not recorded”), and old definitions initially have no evaluation dimensions or fact links. They can be reviewed manually without regeneration or analysis.

The additions are deliberately small:

- `benchmark_query_batches`: business ID, timestamp, count of newly inserted queries, and batch ID.
- `benchmark_queries.origin`, nullable `batch_id`, and `evaluation_dimensions` (a generic array).
- `benchmark_query_truth_links`: unique benchmark/fact ID relationships referencing actual `facts` rows.

Generation still makes exactly one paid request on an explicit click, with the same pinned model, timeout, output cap, refusal/validation handling, and disabled retries. That request now also suggests evaluation dimensions and exact fact keys with an optional offering name. Application code resolves suggestions against the current business, its offerings, and verified facts. Unknown keys, ambiguous offerings/facts, and unverified or foreign-business facts produce no link. Free-form `expected_fact_types` from saved analysis never count as canonical truth.

The `save_benchmark_definitions` invoker RPC saves the batch, new definitions, and links atomically. Exact duplicate query text is skipped without modifying the existing definition, links, or provenance. Batch counts represent newly saved rows; an all-duplicate generation records a zero-query batch. A failed database transaction rolls back all its writes. Network failures can leave the outcome unknown, so reload before retrying. Successful batches are read back before reporting success.

Manual creation uses the same transaction with `origin = manual` and no batch. Query Details supports editing evaluation dimensions and choosing actual verified fact IDs, without AI. `set_benchmark_evaluation` locks the query and atomically replaces its dimensions and links. Both server validation and a database trigger reject cross-business/unverified fact selections. The batch foreign key also enforces business ownership. New tables/RPCs use the existing temporary seeded-business RLS model, not elevated definer permissions.

The UI shows human-readable generation time without exposing raw batch IDs. Canonical fact values are shown separately from optional internal AI interpretation. Unverified existing links are visibly flagged and cannot be newly selected. Deleting a fact removes its links by foreign-key cascade; a factual benchmark with no verified links shows “Truth information missing.” Current fact values are loaded from Truth Hub, not copied from AI output.

Apply `supabase/migrations/202609300005_active_benchmark_set.sql` after migration 004. It replaces the save transaction without adding a table or column. A new generated batch deactivates the previous generated set, activates the newly generated definitions, refreshes exact generated matches, and leaves manual and legacy queries unchanged. Old query results remain attached for history. Raw batch UUIDs remain internal.

For the existing prototype data, apply `supabase/migrations/202609300006_archive_legacy_benchmarks.sql` after migration 005. It deactivates only active rows whose origin was never recorded and whose evaluation dimensions are empty. This removes historical/test prompts from the current benchmark counts without deleting them, changing result history, or touching intentional `manual` rows.

### Future measurement boundary (not implemented)

The intended pipeline is Truth Hub → benchmark definition → evaluation dimensions and canonical fact IDs → scan → structured response extraction → backend comparison → deterministic metrics → optional AI insights. The existing `query_results` fields already hold mention/position and claim counts; `accuracy_percentage` is generated by PostgreSQL from verified/checked counts. FAIR's aggregate metrics likewise derive from evidence fields, never an AI score. Before implementing scans, capture the evaluated fact versions/values with each scan so later Truth Hub edits cannot reinterpret historical measurements, and apply each definition's selected dimensions when deciding what to evaluate. There are no scan calls, scheduled jobs, or automatic analysis/backfills in this change.

### Targeted local checks

Run `node scripts/check-query-architecture.cjs` for offline resolver, schema, metric, server-action, and render checks. Supabase and OpenAI are mocked; this does not execute the SQL migration. Apply and validate the migration in a development database before relying on the new persistence path.
