-- Competition prototype: public read/insert is limited to the current seeded business.
-- This is NOT a production authorization model. No Truth Hub policies are changed.
begin;
create table if not exists public.benchmark_queries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  query_text text not null check (char_length(btrim(query_text)) between 10 and 500),
  category text not null check (category in (
    'Direct product/service search', 'Category discovery', 'Budget/value',
    'Location', 'Audience/persona', 'Feature/specialty', 'Comparison'
  )),
  audience text not null check (char_length(btrim(audience)) between 1 and 120),
  intent text not null check (char_length(btrim(intent)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (business_id, query_text)
);
alter table public.benchmark_queries enable row level security;
grant select, insert on public.benchmark_queries to anon, authenticated;

do $$
declare
  demo_id uuid;
begin
  select id into demo_id from public.businesses order by created_at asc limit 1;
  if demo_id is null then
    raise exception 'Seed a business first, then rerun this migration.';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'benchmark_queries' and policyname = 'Demo benchmark read') then
    execute format('create policy "Demo benchmark read" on public.benchmark_queries for select to anon, authenticated using (business_id = %L::uuid)', demo_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'benchmark_queries' and policyname = 'Demo benchmark insert') then
    execute format('create policy "Demo benchmark insert" on public.benchmark_queries for insert to anon, authenticated with check (business_id = %L::uuid)', demo_id);
  end if;
end $$;
commit;
