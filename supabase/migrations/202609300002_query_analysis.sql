-- Structured meaning belongs to the saved query; no industry-specific columns.
begin;
alter table public.benchmark_queries
  add column if not exists analysis jsonb
  check (analysis is null or jsonb_typeof(analysis) = 'object');

-- Temporary demo access: permit updates only to analysis, for the seeded business.
grant update (analysis) on public.benchmark_queries to anon, authenticated;
do $$
declare demo_id uuid;
begin
  select id into demo_id from public.businesses order by created_at asc limit 1;
  if demo_id is null then raise exception 'Seed a business first.'; end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'benchmark_queries' and policyname = 'Demo query analysis update') then
    execute format('create policy "Demo query analysis update" on public.benchmark_queries for update to anon, authenticated using (business_id = %L::uuid) with check (business_id = %L::uuid)', demo_id, demo_id);
  end if;
end $$;
commit;
