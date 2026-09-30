-- Query organization and the smallest result history needed for FAIR metrics.
-- Temporary demo access remains scoped to the earliest seeded business.
begin;

alter table public.benchmark_queries
  add column if not exists location text,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.query_results (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references public.benchmark_queries(id) on delete cascade,
  ai_platform text not null check (char_length(btrim(ai_platform)) between 1 and 80),
  tested_at timestamptz not null default now(),
  mentioned boolean not null,
  recommendation_position integer check (recommendation_position is null or recommendation_position > 0),
  response_text text,
  response_reference text,
  claims_checked integer not null default 0 check (claims_checked >= 0),
  verified_claims integer not null default 0 check (verified_claims >= 0 and verified_claims <= claims_checked),
  accuracy_percentage numeric(5,2) generated always as (
    case when claims_checked > 0 then round((verified_claims::numeric / claims_checked::numeric) * 100, 2) else null end
  ) stored,
  conflict_count integer not null default 0 check (conflict_count >= 0)
);

create index if not exists query_results_query_tested_idx
  on public.query_results (query_id, tested_at desc);

alter table public.query_results enable row level security;
grant select, insert on public.query_results to anon, authenticated;
grant update (is_active, updated_at) on public.benchmark_queries to anon, authenticated;

do $$
declare demo_id uuid;
begin
  select id into demo_id from public.businesses order by created_at asc limit 1;
  if demo_id is null then raise exception 'Seed a business first.'; end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'benchmark_queries' and policyname = 'Demo benchmark update') then
    execute format('create policy "Demo benchmark update" on public.benchmark_queries for update to anon, authenticated using (business_id = %L::uuid) with check (business_id = %L::uuid)', demo_id, demo_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'query_results' and policyname = 'Demo query result read') then
    execute format('create policy "Demo query result read" on public.query_results for select to anon, authenticated using (exists (select 1 from public.benchmark_queries q where q.id = query_id and q.business_id = %L::uuid))', demo_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'query_results' and policyname = 'Demo query result insert') then
    execute format('create policy "Demo query result insert" on public.query_results for insert to anon, authenticated with check (exists (select 1 from public.benchmark_queries q where q.id = query_id and q.business_id = %L::uuid))', demo_id);
  end if;
end $$;

commit;
