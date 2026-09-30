-- Preserve historical rows while removing undefined legacy/test queries from the active set.
-- Intentional manual queries have origin = 'manual' and are not affected.
begin;

update public.benchmark_queries
set is_active = false, updated_at = now()
where is_active = true
  and origin is null
  and coalesce(cardinality(evaluation_dimensions), 0) = 0;

commit;
