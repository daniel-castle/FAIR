# Benchmark query demo setup

Truth Hub read access was verified: one business, two offerings, three facts. No additional read policies were needed. The benchmark_queries table was not present.

1. Run `supabase/migrations/202609300001_benchmark_queries.sql` in the connected project's SQL Editor. It creates the generic query table and idempotent SELECT/INSERT policies scoped to the earliest seeded business. It does not modify business, offering, fact, or source policies. The public policies are temporary competition-demo access, not production security.
2. Add `OPENAI_API_KEY=...` to `.env.local` (server-only; never use a NEXT_PUBLIC prefix). Generation is pinned to `gpt-5.6-luna`; environment variables cannot override the model. Restart the Next.js server after changing environment variables.
3. Open `/queries`, click **Generate Benchmark Queries**, and confirm 10–15 rows appear. Reload to verify persistence. Existing exact query text is skipped rather than duplicated.

Generation uses one OpenAI Responses API request with SDK retries disabled, structured JSON, and Zod validation. It reads the current demo business, industry, location, offerings, and only verified facts. The Truth Hub template selector is a visit-only preference; generation uses the stored industry and a verified `business_template` fact if one exists. No monitoring is performed.

Reference: https://developers.openai.com/api/docs/guides/structured-outputs

If generation fails, the page displays an error. Refused, incomplete, invalid, or duplicate-containing batches are not saved. Save errors do not masquerade as success. A successful bulk insert is read back before reporting success.

The server action is unauthenticated for this demo. Do not expose the paid generation endpoint as a production feature without authorization and cost controls. Remove the two demo policies before production and replace them with tenant-aware access.

## Query analysis

Run `supabase/migrations/202609300002_query_analysis.sql` to add a nullable `analysis` JSON column and column-scoped demo UPDATE access. Existing generation and query rows remain usable before this migration.

On `/queries`, expand **Query Details** and click **Analyze Query** once. This makes one server-side `gpt-5.6-luna` parsing call for that saved query with a 60-second timeout, 4,000-output-token cap, and no retries or background calls. It validates all metadata with Zod, updates the saved query, and reads it back before reporting success. Reload and expand the same details to verify persistence. A valid saved analysis is reused without another paid request.

Unspecified metadata remains null or an empty list. Analysis describes requested evidence, not verified business truth or an AI monitoring result. The existing benchmark generator still produces only 10–15 queries per manual invocation. Errors appear in the server terminal under `Benchmark query analysis failed:` with redacted diagnostics.
