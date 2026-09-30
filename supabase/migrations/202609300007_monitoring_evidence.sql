-- Manual prototype monitoring, raw evidence, and claim-level deterministic verification.
-- Temporary demo access remains scoped to the earliest seeded business.
begin;

create table public.monitoring_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null check (status in ('pending', 'running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  query_count integer not null default 0 check (query_count >= 0),
  provider text not null check (char_length(btrim(provider)) between 1 and 80),
  model text not null check (char_length(btrim(model)) between 1 and 120),
  error_message text check (error_message is null or char_length(error_message) <= 500)
);

create unique index monitoring_one_active_run_per_business
  on public.monitoring_runs (business_id)
  where status in ('pending', 'running');
create index monitoring_runs_business_started_idx
  on public.monitoring_runs (business_id, started_at desc);

alter table public.query_results
  add column monitoring_run_id uuid references public.monitoring_runs(id) on delete cascade,
  add column business_id uuid references public.businesses(id) on delete cascade,
  add column provider text,
  add column model text,
  add column raw_response_text text,
  add column recommended boolean not null default false,
  add column mentioned_businesses text[] not null default '{}';

alter table public.query_results
  add constraint query_results_run_query_unique unique (monitoring_run_id, query_id);
create index query_results_run_idx on public.query_results (monitoring_run_id, tested_at);

create table public.response_claims (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.query_results(id) on delete cascade,
  fact_id uuid references public.facts(id) on delete set null,
  subject text not null,
  offering text,
  fact_key text,
  observed_value text not null,
  canonical_value_snapshot text,
  verification_status text not null check (verification_status in ('verified', 'conflict', 'needs_review')),
  evidence_text text not null,
  created_at timestamptz not null default now()
);
create index response_claims_result_idx on public.response_claims (result_id);
create index response_claims_fact_idx on public.response_claims (fact_id);

alter table public.monitoring_runs enable row level security;
alter table public.response_claims enable row level security;

grant select, insert on public.monitoring_runs to anon, authenticated;
grant update (status, completed_at, query_count, error_message) on public.monitoring_runs to anon, authenticated;
grant select, insert on public.response_claims to anon, authenticated;
grant update (
  monitoring_run_id, business_id, provider, model, raw_response_text,
  recommended, mentioned_businesses, mentioned, recommendation_position,
  claims_checked, verified_claims, conflict_count
) on public.query_results to anon, authenticated;

do $$
declare demo_id uuid;
begin
  select id into demo_id from public.businesses order by created_at asc limit 1;
  if demo_id is null then raise exception 'Seed a business first.'; end if;

  execute format('create policy "Demo monitoring run read" on public.monitoring_runs for select to anon, authenticated using (business_id = %L::uuid)', demo_id);
  execute format('create policy "Demo monitoring run insert" on public.monitoring_runs for insert to anon, authenticated with check (business_id = %L::uuid)', demo_id);
  execute format('create policy "Demo monitoring run update" on public.monitoring_runs for update to anon, authenticated using (business_id = %L::uuid) with check (business_id = %L::uuid)', demo_id, demo_id);
  execute format('create policy "Demo query result monitoring update" on public.query_results for update to anon, authenticated using (business_id = %L::uuid) with check (business_id = %L::uuid)', demo_id, demo_id);
  execute format('create policy "Demo response claim read" on public.response_claims for select to anon, authenticated using (exists (select 1 from public.query_results r where r.id = result_id and r.business_id = %L::uuid))', demo_id);
  execute format('create policy "Demo response claim insert" on public.response_claims for insert to anon, authenticated with check (exists (select 1 from public.query_results r where r.id = result_id and r.business_id = %L::uuid))', demo_id);
end $$;

commit;
