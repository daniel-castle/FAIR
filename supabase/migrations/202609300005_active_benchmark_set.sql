-- Keep one active generated benchmark set while preserving manual queries and result history.
-- No tables or columns are added; this only replaces the existing save transaction.
begin;

grant update (category, audience, intent, location, is_active, origin, batch_id, evaluation_dimensions, updated_at)
  on public.benchmark_queries to anon, authenticated;

create or replace function public.save_benchmark_definitions(p_business_id uuid, p_origin text, p_queries jsonb)
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
    insert into public.benchmark_query_batches(business_id)
      values (p_business_id) returning id, created_at into batch, generated_at;

    -- Manual and legacy queries are deliberately untouched.
    update public.benchmark_queries
      set is_active = false, updated_at = now()
      where business_id = p_business_id and origin = 'generated' and is_active = true;
  end if;

  for item in select value from jsonb_array_elements(p_queries) loop
    query_id := null;
    dimensions := null;
    select array_agg(value) into dimensions from jsonb_array_elements_text(item->'evaluation_dimensions');
    if coalesce(cardinality(dimensions), 0) = 0 then raise exception 'Select evaluation dimensions.'; end if;

    insert into public.benchmark_queries(
      business_id, query_text, category, audience, intent, location,
      is_active, origin, batch_id, evaluation_dimensions
    ) values (
      p_business_id, item->>'query_text', item->>'category', item->>'audience', item->>'intent', item->>'location',
      coalesce((item->>'is_active')::boolean, true), p_origin, batch, dimensions
    )
    on conflict (business_id, query_text) do update set
      category = excluded.category,
      audience = excluded.audience,
      intent = excluded.intent,
      location = excluded.location,
      is_active = true,
      origin = 'generated',
      batch_id = excluded.batch_id,
      evaluation_dimensions = excluded.evaluation_dimensions,
      updated_at = now()
    where p_origin = 'generated' and public.benchmark_queries.origin = 'generated'
    returning id into query_id;

    if query_id is null and p_origin = 'manual' then
      raise exception 'This exact benchmark query already exists.';
    end if;

    -- An exact manual-query collision remains manual and is not added to this generated set.
    if query_id is not null then
      query_ids := array_append(query_ids, query_id);
      delete from public.benchmark_query_truth_links where benchmark_query_id = query_id;
      for fact in select value::uuid from jsonb_array_elements_text(item->'fact_ids') loop
        insert into public.benchmark_query_truth_links(benchmark_query_id, fact_id) values (query_id, fact);
      end loop;
    end if;
  end loop;

  if batch is not null then
    if cardinality(query_ids) = 0 then raise exception 'No generated benchmarks could be activated.'; end if;
    update public.benchmark_query_batches set query_count = cardinality(query_ids) where id = batch;
  end if;

  return jsonb_build_object(
    'batch_id', batch,
    'created_at', generated_at,
    'query_count', cardinality(query_ids),
    'query_ids', to_jsonb(query_ids)
  );
end $$;

revoke all on function public.save_benchmark_definitions(uuid, text, jsonb) from public;
grant execute on function public.save_benchmark_definitions(uuid, text, jsonb) to anon, authenticated;

commit;
