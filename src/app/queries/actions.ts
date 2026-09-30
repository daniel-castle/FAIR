"use server";

import { z } from "zod";
import { calculateQueryMetrics } from "@/lib/queries/metrics";
import { evaluationInputSchema, resolveTruthSuggestions, truthFactsForBusiness, type GenerationBatch, type TruthFact } from "@/lib/queries/evaluation";
import { revalidatePath } from "next/cache";
import { loadTruthHub } from "@/app/truth-hub/actions";
import { createSupabaseClient } from "@/lib/supabase/server";
import { buildQueryContext } from "@/lib/queries/context";
import { generateQueries } from "@/lib/queries/generate";
import { benchmarkErrorDetails } from "@/lib/queries/error-log";
import { manualQuerySchema, type QueryResult, type SavedQuery } from "@/lib/queries/schema";

export type QueryMetrics = ReturnType<typeof calculateQueryMetrics>;
export type QueryLibrary = {
  queries: SavedQuery[];
  businessName: string;
  metrics: QueryMetrics;
  batches: GenerationBatch[];
  truthFacts: TruthFact[];
  definitionSetup?: string;
  truthSetup?: string;
  error?: string;
  setup?: string;
  generationSetup?: string;
  resultsSetup?: string;
};
export type ActionResult = { error?: string; message?: string };
type QueryRow = {
  id: string;
  query_text: string;
  category: SavedQuery["category"];
  audience: string;
  intent: string;
  created_at: string;
  location?: string | null;
  is_active?: boolean;
  updated_at?: string;
};

const legacyColumns = "id,query_text,category,audience,intent,created_at";
const queryColumns = `${legacyColumns},location,is_active,updated_at`;
const resultColumns = "id,query_id,ai_platform,tested_at,mentioned,recommendation_position,response_text,response_reference,claims_checked,verified_claims,accuracy_percentage,conflict_count";
const emptyMetrics = calculateQueryMetrics([]);
const definitionSetupMessage = "Benchmark definitions need supabase/migrations/202609300004_benchmark_definitions.sql and read/write access.";

async function currentBusiness() {
  const db = createSupabaseClient();
  if (!db) return { db: null, business: null, error: "Supabase is not configured." };
  const result = await db.from("businesses").select("id,name").order("created_at").limit(1).maybeSingle();
  if (result.error || !result.data) return { db, business: null, error: "No demo business is visible. Check Truth Hub and Supabase read policies." };
  return { db, business: result.data, error: undefined };
}

export async function loadQueryLibrary(): Promise<QueryLibrary> {
  const empty = { queries: [], businessName: "your business", metrics: emptyMetrics, batches: [], truthFacts: [] };
  const { db, business, error } = await currentBusiness();
  if (!db || !business) return { ...empty, error };

  const extendedResult = await db.from("benchmark_queries").select(queryColumns).eq("business_id", business.id).order("created_at", { ascending: false });
  const schemaReady = !extendedResult.error;
  const legacyResult = schemaReady ? null : await db.from("benchmark_queries").select(legacyColumns).eq("business_id", business.id).order("created_at", { ascending: false });
  if (extendedResult.error && legacyResult?.error) return { ...empty, businessName: business.name, error: "Could not load benchmark queries. Apply the benchmark query migrations and check read access." };
  const queryRows = (schemaReady ? extendedResult.data : legacyResult?.data ?? []) as QueryRow[];

  const baseQueries = queryRows.map(row => {
    return {
      ...row,
      location: row.location ?? null,
      is_active: row.is_active ?? true,
      updated_at: row.updated_at ?? row.created_at,
      results: [],
    } as SavedQuery;
  });

  let results: QueryResult[] = [];
  let resultsSetup: string | undefined;
  if (schemaReady && baseQueries.length) {
    const resultRows = await db.from("query_results").select(resultColumns).in("query_id", baseQueries.map(query => query.id)).order("tested_at", { ascending: false });
    if (resultRows.error) resultsSetup = "Result tracking needs supabase/migrations/202609300003_query_metrics.sql and SELECT access.";
    else results = (resultRows.data ?? []) as QueryResult[];
  } else if (!schemaReady) {
    resultsSetup = "Query metrics need supabase/migrations/202609300003_query_metrics.sql.";
  }

  const resultsByQuery = new Map<string, QueryResult[]>();
  for (const result of results) resultsByQuery.set(result.query_id, [...(resultsByQuery.get(result.query_id) ?? []), result]);
  const [definitions, batchRows, linkRows, hub] = await Promise.all([
    db.from("benchmark_queries").select("id,origin,batch_id,evaluation_dimensions").eq("business_id", business.id),
    db.from("benchmark_query_batches").select("id,created_at,query_count").eq("business_id", business.id).order("created_at", { ascending: false }),
    baseQueries.length ? db.from("benchmark_query_truth_links").select("benchmark_query_id,fact_id").in("benchmark_query_id", baseQueries.map(query => query.id)) : Promise.resolve({ data: [], error: null }),
    loadTruthHub(),
  ]);
  const definitionSetup = definitions.error || batchRows.error || linkRows.error ? definitionSetupMessage : undefined;
  const truthSetup = hub.errors.length || hub.business?.id !== business.id ? "Truth Hub facts could not be loaded. Reload before editing evaluation targets." : undefined;
  const truthFacts = truthSetup ? [] : truthFactsForBusiness(hub);
  const factsById = new Map(truthFacts.map(fact => [fact.id, fact]));
  const batches = (batchRows.data ?? []) as GenerationBatch[];
  const definitionsById = new Map((definitions.data ?? []).map(row => [row.id, row]));
  const queries = baseQueries.map(query => {
    const definition = definitionsById.get(query.id);
    return {
      ...query, ...definition,
      batch: batches.find(batch => batch.id === definition?.batch_id) ?? null,
      truth_links: (linkRows.data ?? []).filter(link => link.benchmark_query_id === query.id).flatMap(link => {
        const fact = factsById.get(link.fact_id);
        return fact ? [fact] : [];
      }),
      results: resultsByQuery.get(query.id) ?? [],
    } as SavedQuery;
  });

  return {
    businessName: business.name,
    queries,
    metrics: calculateQueryMetrics(queries),
    batches, truthFacts, definitionSetup, truthSetup,
    setup: schemaReady ? undefined : "Manual fields and active status need the 202609300003_query_metrics.sql migration.",
    resultsSetup,
    generationSetup: !process.env.OPENAI_API_KEY ? "Existing AI generation needs OPENAI_API_KEY in .env.local and an app restart." : undefined,
  };
}

export async function createBenchmarkQuery(input: unknown, evaluation: unknown): Promise<ActionResult> {
  const parsed = manualQuerySchema.safeParse(input);
  const targets = evaluationInputSchema.safeParse(evaluation);
  if (!parsed.success || !targets.success) return { error: "Complete the query fields and select at least one evaluation dimension." };
  const { db, business, error } = await currentBusiness();
  if (!db || !business) return { error };
  const hub = await loadTruthHub();
  if (hub.errors.length || hub.business?.id !== business.id) return { error: "Truth Hub could not be loaded. Nothing was saved." };
  const validIds = new Set(truthFactsForBusiness(hub).filter(fact => fact.verified).map(fact => fact.id));
  if (targets.data.fact_ids.some(id => !validIds.has(id))) return { error: "Select verified facts from this business's Truth Hub." };
  const saved = await db.rpc("save_benchmark_definitions", { p_business_id: business.id, p_origin: "manual", p_queries: [{ ...parsed.data, evaluation_dimensions: targets.data.dimensions, fact_ids: targets.data.fact_ids }] });
  if (saved.error) return { error: saved.error.message.includes("already exists") ? "This exact benchmark query already exists." : "The benchmark was not saved. Check the definitions migration and write access." };
  const check = await db.from("benchmark_queries").select("id").eq("business_id", business.id).in("id", saved.data.query_ids);
  if (check.error || check.data?.length !== 1) return { error: "Save returned, but read-back failed. Reload before retrying." };
  revalidatePath("/queries");
  return { message: "Manual benchmark and evaluation targets saved." };
}

export async function saveBenchmarkEvaluation(queryId: string, input: unknown): Promise<ActionResult> {
  const parsed = evaluationInputSchema.safeParse(input);
  if (!z.uuid().safeParse(queryId).success || !parsed.success) return { error: "Select a saved query and valid evaluation targets." };
  const { db, business, error } = await currentBusiness();
  if (!db || !business) return { error };
  const hub = await loadTruthHub();
  if (hub.errors.length || hub.business?.id !== business.id) return { error: "Truth Hub could not be loaded. Targets were not changed." };
  const validIds = new Set(truthFactsForBusiness(hub).filter(fact => fact.verified).map(fact => fact.id));
  if (parsed.data.fact_ids.some(id => !validIds.has(id))) return { error: "Select verified facts from this business's Truth Hub." };
  const saved = await db.rpc("set_benchmark_evaluation", { p_business_id: business.id, p_query_id: queryId, p_dimensions: parsed.data.dimensions, p_fact_ids: parsed.data.fact_ids });
  if (saved.error) return { error: "Evaluation targets were not saved. Check the definitions migration, fact verification, and write access." };
  revalidatePath("/queries");
  return { message: "Evaluation targets and canonical fact links saved." };
}

export async function setBenchmarkQueryActive(queryId: string, isActive: boolean): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(queryId) || typeof isActive !== "boolean") return { error: "Select a valid query." };
  const { db, business, error } = await currentBusiness();
  if (!db || !business) return { error };
  const saved = await db.from("benchmark_queries").update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", queryId).eq("business_id", business.id).select("id").maybeSingle();
  if (saved.error || !saved.data) return { error: "The query status could not be updated. Check the demo UPDATE policy." };
  revalidatePath("/queries");
  return { message: `Query ${isActive ? "activated" : "paused"}.` };
}

export async function generateBenchmarkQueries(): Promise<ActionResult> {
  try {
    const db = createSupabaseClient();
    if (!db) return { error: "Supabase is not configured." };
    const hub = await loadTruthHub();
    if (!hub.business || hub.errors.length) return { error: hub.errors.join(" ") || "Load a business in Truth Hub first." };
    const preflight = await db.from("benchmark_queries").select("id,origin,batch_id,evaluation_dimensions").eq("business_id", hub.business.id).limit(1);
    const batchPreflight = await db.from("benchmark_query_batches").select("id").eq("business_id", hub.business.id).limit(1);
    const linkPreflight = await db.from("benchmark_query_truth_links").select("id").limit(1);
    if (preflight.error || batchPreflight.error || linkPreflight.error) return { error: definitionSetupMessage };
    const queries = await generateQueries(buildQueryContext(hub));
    const definitions = queries.map(({ truth_suggestions, ...query }) => ({ ...query, fact_ids: resolveTruthSuggestions(hub, truth_suggestions) }));
    const saved = await db.rpc("save_benchmark_definitions", { p_business_id: hub.business.id, p_origin: "generated", p_queries: definitions });
    if (saved.error) return { error: "Batch save could not be confirmed. Reload before retrying; check the definitions migration, verified facts, and write access." };
    const count = saved.data.query_count as number;
    const [check, batchCheck] = await Promise.all([
      count ? db.from("benchmark_queries").select("id").eq("business_id", hub.business.id).eq("batch_id", saved.data.batch_id) : Promise.resolve({ data: [], error: null }),
      db.from("benchmark_query_batches").select("id,query_count").eq("business_id", hub.business.id).eq("id", saved.data.batch_id).single(),
    ]);
    if (check.error || check.data?.length !== count || batchCheck.error || batchCheck.data?.query_count !== count) return { error: "Batch save returned, but read-back failed. Reload before generating again." };
    revalidatePath("/queries");
    return { message: `${count} generated queries are now active. The previous generated set was archived; manual queries were preserved.` };

  } catch (caught) {
    console.error("Benchmark generation failed:", benchmarkErrorDetails(caught));
    return { error: caught instanceof Error && (caught.message.startsWith("Set OPENAI") || caught.message.startsWith("The model") || caught.message.startsWith("The generated")) ? caught.message : "Query generation or save could not be confirmed. Reload before retrying, then check the server diagnostics." };
  }
}
