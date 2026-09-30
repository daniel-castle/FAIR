"use server";

import { revalidatePath } from "next/cache";
import { loadTruthHub } from "@/app/truth-hub/actions";
import { createSupabaseClient } from "@/lib/supabase/server";
import { buildQueryContext } from "@/lib/queries/context";
import { generateQueries } from "@/lib/queries/generate";
import { benchmarkErrorDetails } from "@/lib/queries/error-log";
import type { SavedQuery } from "@/lib/queries/schema";

export type QueryLibrary = { queries: SavedQuery[]; businessName: string; error?: string; setup?: string };
export type GenerateResult = { error?: string; message?: string };
const columns = "id,query_text,category,audience,intent,created_at";

export async function loadQueryLibrary(): Promise<QueryLibrary> {
  const empty = { queries: [], businessName: "your business" };
  const db = createSupabaseClient();
  if (!db) return { ...empty, error: "Supabase is not configured." };
  const { data: business, error } = await db.from("businesses").select("id,name").order("created_at").limit(1).maybeSingle();
  if (error || !business) return { ...empty, error: "No demo business is visible. Check Truth Hub and Supabase read policies." };
  const result = await db.from("benchmark_queries").select(columns).eq("business_id", business.id).order("created_at", { ascending: false });
  return {
    businessName: business.name,
    queries: (result.data ?? []) as SavedQuery[],
    error: result.error ? "Could not load benchmark queries. Apply supabase/migrations/202609300001_benchmark_queries.sql in Supabase SQL Editor and check read access." : undefined,
    setup: !process.env.OPENAI_API_KEY ? "Generation needs OPENAI_API_KEY in .env.local and an app restart." : undefined,
  };
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
