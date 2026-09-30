"use server";

import { revalidatePath } from "next/cache";
import { loadTruthHub } from "@/app/truth-hub/actions";
import { createSupabaseClient } from "@/lib/supabase/server";
import { buildQueryContext } from "@/lib/queries/context";
import { generateQueries } from "@/lib/queries/generate";
import { benchmarkErrorDetails } from "@/lib/queries/error-log";
import type { SavedQuery } from "@/lib/queries/schema";
import { analyzeQuery } from "@/lib/queries/analyze";
import { queryAnalysisSchema } from "@/lib/queries/analysis-schema";

export type QueryLibrary = { queries: SavedQuery[]; businessName: string; error?: string; setup?: string; analysisSetup?: string };
export type GenerateResult = { error?: string; message?: string };
const columns = "id,query_text,category,audience,intent,created_at";

export async function loadQueryLibrary(): Promise<QueryLibrary> {
  const empty = { queries: [], businessName: "your business" };
  const db = createSupabaseClient();
  if (!db) return { ...empty, error: "Supabase is not configured." };
  const { data: business, error } = await db.from("businesses").select("id,name").order("created_at").limit(1).maybeSingle();
  if (error || !business) return { ...empty, error: "No demo business is visible. Check Truth Hub and Supabase read policies." };
  const result = await db.from("benchmark_queries").select(columns).eq("business_id", business.id).order("created_at", { ascending: false });
  const analyses = await db.from("benchmark_queries").select("id,analysis").eq("business_id", business.id);
  const analysisById = new Map((analyses.data ?? []).map(row => [row.id, queryAnalysisSchema.safeParse(row.analysis)]));
  return {
    businessName: business.name,
    queries: (result.data ?? []).map(row => {
      const parsed = analysisById.get(row.id);
      return { ...row, analysis: parsed?.success ? parsed.data : null };
    }) as SavedQuery[],
    analysisSetup: analyses.error ? "Query analysis needs the 202609300002_query_analysis.sql migration and read access." : undefined,
    error: result.error ? "Could not load benchmark queries. Apply supabase/migrations/202609300001_benchmark_queries.sql in Supabase SQL Editor and check read access." : undefined,
    setup: !process.env.OPENAI_API_KEY ? "Generation needs OPENAI_API_KEY in .env.local and an app restart." : undefined,
  };
}

export async function analyzeBenchmarkQuery(queryId: string): Promise<GenerateResult> {
  try {
    if (typeof queryId !== "string" || !/^[0-9a-f-]{36}$/i.test(queryId)) return { error: "Select a saved query to analyze." };
    const db = createSupabaseClient();
    if (!db) return { error: "Supabase is not configured." };
    const hub = await loadTruthHub();
    if (!hub.business || hub.errors.length) return { error: hub.errors.join(" ") || "Load the business in Truth Hub first." };
    // Read the persisted text and check schema availability before a billable call.
    const current = await db.from("benchmark_queries").select("id,query_text,analysis").eq("business_id", hub.business.id).eq("id", queryId).maybeSingle();
    if (current.error) return { error: "Analysis storage is unavailable. Apply the query analysis migration and check read access." };
    if (!current.data) return { error: "This query is not available for the current business." };
    if (queryAnalysisSchema.safeParse(current.data.analysis).success) return { message: "This query already has saved analysis." };
    const analysis = await analyzeQuery(current.data.query_text, buildQueryContext(hub));
    const saved = await db.from("benchmark_queries").update({ analysis }).eq("id", queryId).eq("business_id", hub.business.id).eq("query_text", current.data.query_text).select("id").single();
    if (saved.error) return { error: "Analysis was generated but could not be saved. Check the analysis UPDATE policy before retrying." };
    const check = await db.from("benchmark_queries").select("analysis").eq("id", queryId).eq("business_id", hub.business.id).single();
    if (check.error || !queryAnalysisSchema.safeParse(check.data?.analysis).success) return { error: "Analysis save returned, but read-back failed. Reload before retrying." };
    revalidatePath("/queries");
    return { message: "Analysis saved. Open Query Details to inspect it." };
  } catch (error) {
    console.error("Benchmark query analysis failed:", benchmarkErrorDetails(error));
    return { error: "Query analysis failed. Check the server terminal for details." };
  }
}

export async function generateBenchmarkQueries(): Promise<GenerateResult> {
  try {
    const db = createSupabaseClient();
    if (!db) return { error: "Supabase is not configured." };
    const hub = await loadTruthHub();
    if (!hub.business || hub.errors.length) return { error: hub.errors.join(" ") || "Load a business in Truth Hub first." };
    // Check the destination before making a billable AI request.
    const preflight = await db.from("benchmark_queries").select("id").eq("business_id", hub.business.id).limit(1);
    if (preflight.error) return { error: "Benchmark storage is not ready. Apply the benchmark_queries SQL migration first." };
    const queries = await generateQueries(buildQueryContext(hub));
    // One atomic bulk insert; repeated query text is ignored rather than duplicated.
    const saved = await db.from("benchmark_queries").upsert(
      queries.map(q => ({ ...q, business_id: hub.business!.id })),
      { onConflict: "business_id,query_text", ignoreDuplicates: true },
    ).select("id");
    if (saved.error) return { error: `Queries were generated but saving failed: ${saved.error.message}. Check the benchmark insert policy before retrying.` };
    const count = saved.data?.length ?? 0;
    // Re-read persisted rows so success does not rely on optimistic client state.
    if (count) {
      const check = await db.from("benchmark_queries").select("id").eq("business_id", hub.business.id).in("id", saved.data!.map(q => q.id));
      if (check.error || check.data?.length !== count) return { error: "The save returned, but saved rows could not be read back. Check SELECT policies and reload before generating again." };
    }
    revalidatePath("/queries");
    return { message: count ? `Saved ${count} benchmark queries. ${queries.length - count ? "Existing duplicates were skipped." : "Ready for future AI scans."}` : "All generated queries already exist in your library." };
  } catch (error) {
    console.error("Benchmark generation failed:", benchmarkErrorDetails(error));
    return { error: error instanceof Error && (error.message.startsWith("Set OPENAI") || error.message.startsWith("The model") || error.message.startsWith("The generated")) ? error.message : "Query generation failed. Check the server’s OpenAI key, model access, and API quota, then retry. No query batch was saved." };
  }
}
