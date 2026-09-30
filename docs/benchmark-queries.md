# Benchmark query demo setup

Truth Hub read access was verified: one business, two offerings, three facts. No additional read policies were needed. The benchmark_queries table was not present.

1. Run `supabase/migrations/202609300001_benchmark_queries.sql` in the connected project's SQL Editor. It creates the generic query table and idempotent SELECT/INSERT policies scoped to the earliest seeded business. It does not modify business, offering, fact, or source policies. The public policies are temporary competition-demo access, not production security.
2. Add `OPENAI_API_KEY=...` to `.env.local` (server-only; never use a NEXT_PUBLIC prefix). Optionally set `OPENAI_MODEL=gpt-4.1-mini` to override the default. Restart the Next.js server after changing environment variables.
3. Open `/queries`, click **Generate Benchmark Queries**, and confirm 10–15 rows appear. Reload to verify persistence. Existing exact query text is skipped rather than duplicated.

Generation uses one OpenAI Responses API request with SDK retries disabled, structured JSON, and Zod validation. It reads the current demo business, industry, location, offerings, and only verified facts. The Truth Hub template selector is a visit-only preference; generation uses the stored industry and a verified `business_template` fact if one exists. No monitoring is performed.

Reference: https://developers.openai.com/api/docs/guides/structured-outputs

If generation fails, the page displays an error. Refused, incomplete, invalid, or duplicate-containing batches are not saved. Save errors do not masquerade as success. A successful bulk insert is read back before reporting success.

The server action is unauthenticated for this demo. Do not expose the paid generation endpoint as a production feature without authorization and cost controls. Remove the two demo policies before production and replace them with tenant-aware access.
