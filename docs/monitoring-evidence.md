# Monitoring evidence and deterministic metrics

Apply these migrations after the existing benchmark migrations:

1. `supabase/migrations/202609300006_archive_legacy_benchmarks.sql`
2. `supabase/migrations/202609300007_monitoring_evidence.sql`

Migration 006 preserves all historical queries and results but deactivates active legacy rows that have no recorded origin and no evaluation dimensions. It does not modify intentional `manual` queries or the current structured generated batch.

Migration 007 adds monitoring runs, raw-response metadata, and claim-level evidence. Its anonymous policies follow the existing temporary seeded-business competition-demo model and must be replaced by tenant-aware authentication before production.

## Evidence boundary

The manual prototype pipeline is:

`active benchmark → raw monitored-model answer → deterministic evidence parsing → deterministic identity/fact comparison → deterministic aggregate metrics`

The raw answer is inserted before evaluation. If parsing or comparison later fails, the run is marked failed and the already-saved raw evidence remains available.

There is no second model-based grading or extraction request in the competition prototype. Application code normalizes the monitored business identity, conservatively recognizes explicit recommendation/list structure, and compares only benchmark-linked facts against the raw response. Ambiguous recommendation positions and fact comparisons remain null or `needs_review`.

Only `verified` and `conflict` claims count as comparable claims. `needs_review` claims remain inspectable but are excluded from the accuracy denominator.

## Metric formulas

- Mention Rate = mentioned tested results / tested results.
- Recommendation Rate = recommended tested results / tested results.
- Top Recommendation Rate = position-one results / tested results.
- Average Recommendation Position = average of non-null recommendation positions.
- Fact Accuracy = total verified comparable claims / total comparable claims checked.
- Conflict Rate = total conflicting comparable claims / total comparable claims checked.
- Test Coverage = active queries represented in the latest completed run / current active queries.
- Category and Audience Visibility = Mention Rate grouped by the saved benchmark category or audience.
- Offering Coverage = linked offerings represented by tested active queries / linked offerings represented by active queries. It describes FAIR's controlled benchmark only.

All headline metrics use current active benchmarks and the latest completed monitoring run. Inactive historical results remain stored but do not enter current scores.

## Controlled scan request count

`MAX_QUERIES_PER_RUN` is 5. Each selected query makes exactly one request:

1. One `gpt-5.6-luna` request for the monitored raw answer.

A full five-query run therefore makes 5 OpenAI requests. SDK retries are disabled. Scans are manual, have an explicit confirmation, and do not use background jobs, scheduling, polling, or automatic execution.

Run `npm run check:monitoring` to validate schemas, normalization, verification, formulas, active-set exclusion, aggregate accuracy, and request safeguards without contacting Supabase or OpenAI.
