-- Definitions and provenance only. No scans, result writes, or AI execution.
-- Retains the existing seeded-business demo authorization model.
begin;

create table public.benchmark_query_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  query_count integer not null default 0 check (query_count >= 0),
  unique (id, business_id)
);
alter table public.benchmark_queries
  add column origin text check (origin in ('generated', 'manual')),
  add column batch_id uuid,
  add column evaluation_dimensions text[] not null default '{}',
  add constraint benchmark_batch_business_fk foreign key (batch_id, business_id)
    references public.benchmark_query_batches(id, business_id),
  add constraint benchmark_origin_batch_check check (batch_id is null or origin is not distinct from 'generated'),
  add constraint benchmark_dimensions_check check (
    evaluation_dimensions <@ array['visibility','recommendation','recommendation_position','factual_accuracy','competitor_presence']::text[]
    and array_position(evaluation_dimensions, null) is null
  );
-- NULL origin means historical provenance was not recorded; do not guess it.
create index benchmark_queries_batch_idx on public.benchmark_queries(batch_id);
create table public.benchmark_query_truth_links (
  id uuid primary key default gen_random_uuid(),
  benchmark_query_id uuid not null references public.benchmark_queries(id) on delete cascade,
  fact_id uuid not null references public.facts(id) on delete cascade,
  unique (benchmark_query_id, fact_id)
);
create index benchmark_truth_links_fact_idx on public.benchmark_query_truth_links(fact_id);

-- Enforce ownership at the database boundary, including calls made outside the app.
create function public.validate_benchmark_truth_link() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if not exists (
    select 1 from public.benchmark_queries q join public.facts f on f.business_id = q.business_id
    where q.id = new.benchmark_query_id and f.id = new.fact_id and f.verified = true
      and (f.offering_id is null or exists (
        select 1 from public.offerings o where o.id = f.offering_id and o.business_id = q.business_id
      ))
  ) then raise exception 'Select a verified fact belonging to this benchmark business.'; end if;
  return new;
end $$;
create trigger benchmark_truth_link_scope before insert or update on public.benchmark_query_truth_links
for each row execute function public.validate_benchmark_truth_link();

alter table public.benchmark_query_batches enable row level security;
alter table public.benchmark_query_truth_links enable row level security;
grant select, insert on public.benchmark_query_batches to anon, authenticated;
grant update (query_count) on public.benchmark_query_batches to anon, authenticated;
grant select, insert, delete on public.benchmark_query_truth_links to anon, authenticated;
grant update (evaluation_dimensions) on public.benchmark_queries to anon, authenticated;
do $$
declare demo_id uuid;
begin
  select id into demo_id from public.businesses order by created_at limit 1;
  if demo_id is null then raise exception 'Seed a business first.'; end if;
  execute format('create policy "Demo batch read" on public.benchmark_query_batches for select to anon, authenticated using (business_id = %L::uuid)', demo_id);
  execute format('create policy "Demo batch insert" on public.benchmark_query_batches for insert to anon, authenticated with check (business_id = %L::uuid)', demo_id);
  execute format('create policy "Demo batch count update" on public.benchmark_query_batches for update to anon, authenticated using (business_id = %L::uuid) with check (business_id = %L::uuid)', demo_id, demo_id);
  execute format('create policy "Demo truth link read" on public.benchmark_query_truth_links for select to anon, authenticated using (exists (select 1 from public.benchmark_queries q where q.id = benchmark_query_id and q.business_id = %L::uuid))', demo_id);
  execute format('create policy "Demo truth link insert" on public.benchmark_query_truth_links for insert to anon, authenticated with check (exists (select 1 from public.benchmark_queries q where q.id = benchmark_query_id and q.business_id = %L::uuid))', demo_id);
  execute format('create policy "Demo truth link delete" on public.benchmark_query_truth_links for delete to anon, authenticated using (exists (select 1 from public.benchmark_queries q where q.id = benchmark_query_id and q.business_id = %L::uuid))', demo_id);
end $$;

-- A single transaction: duplicate generated text keeps its old batch and links.
-- Any invalid link or insert failure rolls back the entire new batch.
create function public.save_benchmark_definitions(p_business_id uuid, p_origin text, p_queries jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  batch uuid; generated_at timestamptz; item jsonb; query_id uuid;
  query_ids uuid[] := '{}'; dimensions text[]; fact uuid;
begin
  if p_origin is null or p_origin not in ('generated', 'manual') or jsonb_typeof(p_queries) is distinct from 'array' then
    raise exception 'Invalid benchmark definitions.';
  end if;
  if (p_origin = 'generated' and jsonb_array_length(p_queries) not between 10 and 15)
     or (p_origin = 'manual' and jsonb_array_length(p_queries) <> 1) then
    raise exception 'Invalid benchmark count.';
  end if;
  if p_origin = 'generated' then
    insert into public.benchmark_query_batches(business_id) values (p_business_id) returning id, created_at into batch, generated_at;
  end if;
  for item in select value from jsonb_array_elements(p_queries) loop
    select array_agg(value) into dimensions from jsonb_array_elements_text(item->'evaluation_dimensions');
    if coalesce(cardinality(dimensions), 0) = 0 then raise exception 'Select evaluation dimensions.'; end if;
    insert into public.benchmark_queries(business_id, query_text, category, audience, intent, location, is_active, origin, batch_id, evaluation_dimensions)
    values (p_business_id, item->>'query_text', item->>'category', item->>'audience', item->>'intent', item->>'location', coalesce((item->>'is_active')::boolean, true), p_origin, batch, dimensions)
    on conflict (business_id, query_text) do nothing returning id into query_id;
    if query_id is null and p_origin = 'manual' then raise exception 'This exact benchmark query already exists.'; end if;
    if query_id is not null then
      query_ids := array_append(query_ids, query_id);
      for fact in select value::uuid from jsonb_array_elements_text(item->'fact_ids') loop
        insert into public.benchmark_query_truth_links(benchmark_query_id, fact_id) values (query_id, fact);
      end loop;
    end if;
  end loop;
  if batch is not null then update public.benchmark_query_batches set query_count = cardinality(query_ids) where id = batch; end if;
  return jsonb_build_object('batch_id', batch, 'created_at', generated_at, 'query_count', cardinality(query_ids), 'query_ids', to_jsonb(query_ids));
end $$;

create function public.set_benchmark_evaluation(p_business_id uuid, p_query_id uuid, p_dimensions text[], p_fact_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  if coalesce(cardinality(p_dimensions), 0) = 0 then raise exception 'Select evaluation dimensions.'; end if;
  -- Serialize edits so two reviewers cannot leave a union of incompatible link sets.
  perform 1 from public.benchmark_queries where id = p_query_id and business_id = p_business_id for update;
  if not found then raise exception 'Benchmark unavailable for this business.'; end if;
  update public.benchmark_queries set evaluation_dimensions = p_dimensions, updated_at = now() where id = p_query_id and business_id = p_business_id;
  delete from public.benchmark_query_truth_links where benchmark_query_id = p_query_id;
  insert into public.benchmark_query_truth_links(benchmark_query_id, fact_id)
    select p_query_id, fact from unnest(p_fact_ids) fact;
end $$;
revoke all on function public.save_benchmark_definitions(uuid, text, jsonb) from public;
revoke all on function public.set_benchmark_evaluation(uuid, uuid, text[], uuid[]) from public;
grant execute on function public.save_benchmark_definitions(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.set_benchmark_evaluation(uuid, uuid, text[], uuid[]) to anon, authenticated;
commit;
