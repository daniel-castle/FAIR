import "server-only";
import { createSupabaseClient } from "@/lib/supabase/server";
import { calculateMonitoringMetrics, type MetricResult } from "@/lib/metrics/monitoring";
import type { MonitoringResult, MonitoringRun, ResponseClaim } from "./schema";

type QueryRow = { id: string; query_text: string; category: string; audience: string; is_active: boolean };
type ResultRow = Omit<MonitoringResult, "query_text" | "category" | "audience" | "claims">;

export type MonitoringDashboardData = {
  businessName: string;
  latestRun: MonitoringRun | null;
  metricRun: MonitoringRun | null;
  results: MonitoringResult[];
  metrics: ReturnType<typeof calculateMonitoringMetrics>;
  setup?: string;
};

const emptyMetrics = calculateMonitoringMetrics([], []);
const resultColumns = "id,monitoring_run_id,query_id,business_id,provider,model,tested_at,raw_response_text,mentioned,recommended,recommendation_position,mentioned_businesses,claims_checked,verified_claims,conflict_count";

export async function loadMonitoringDashboard(): Promise<MonitoringDashboardData> {
  const db = createSupabaseClient();
  const empty = { businessName: "your business", latestRun: null, metricRun: null, results: [], metrics: emptyMetrics };
  if (!db) return { ...empty, setup: "Supabase is not configured." };
  const database = db;
  const businessResult = await database.from("businesses").select("id,name").order("created_at").limit(1).maybeSingle();
  if (businessResult.error || !businessResult.data) return { ...empty, setup: "No demo business is visible." };
  const business = businessResult.data;
  const [queriesResult, runsResult] = await Promise.all([
    database.from("benchmark_queries").select("id,query_text,category,audience,is_active").eq("business_id", business.id),
    database.from("monitoring_runs").select("id,business_id,status,started_at,completed_at,query_count,provider,model,error_message").eq("business_id", business.id).order("started_at", { ascending: false }).limit(20),
  ]);
  if (queriesResult.error) return { ...empty, businessName: business.name, setup: "Benchmark queries could not be loaded." };
  if (runsResult.error) return { ...empty, businessName: business.name, setup: "Apply supabase/migrations/202609300007_monitoring_evidence.sql to enable monitoring." };

  const queries = (queriesResult.data ?? []) as QueryRow[];
  const runs = (runsResult.data ?? []) as MonitoringRun[];
  const latestRun = runs[0] ?? null;
  const metricRun = runs.find(run => run.status === "completed") ?? null;

  async function loadResults(run: MonitoringRun | null) {
    if (!run) return { rows: [] as ResultRow[], error: null };
    const response = await database.from("query_results").select(resultColumns).eq("monitoring_run_id", run.id).order("tested_at", { ascending: true });
    return { rows: (response.data ?? []) as ResultRow[], error: response.error };
  }

  const [latestResponse, metricResponse] = await Promise.all([
    loadResults(latestRun),
    metricRun?.id === latestRun?.id ? Promise.resolve(null) : loadResults(metricRun),
  ]);
  if (latestResponse.error || metricResponse?.error) return { ...empty, businessName: business.name, latestRun, metricRun, setup: "Monitoring results could not be loaded. Check migration 007 and read access." };

  const latestRows = latestResponse.rows;
  let claims: ResponseClaim[] = [];
  if (latestRows.length) {
    const claimsResult = await database.from("response_claims").select("id,result_id,fact_id,subject,offering,fact_key,observed_value,canonical_value_snapshot,verification_status,evidence_text,created_at").in("result_id", latestRows.map(result => result.id)).order("created_at");
    if (claimsResult.error) return { ...empty, businessName: business.name, latestRun, metricRun, setup: "Claim evidence could not be loaded. Check migration 007 and read access." };
    claims = (claimsResult.data ?? []) as ResponseClaim[];
  }

  const queryById = new Map(queries.map(query => [query.id, query]));
  const results = latestRows.flatMap(result => {
    const query = queryById.get(result.query_id);
    return query ? [{ ...result, query_text: query.query_text, category: query.category, audience: query.audience, claims: claims.filter(claim => claim.result_id === result.id) }] : [];
  });

  const activeIds = queries.filter(query => query.is_active).map(query => query.id);
  const queryOfferingIds: Record<string, string[]> = {};
  if (activeIds.length) {
    const linkResult = await database.from("benchmark_query_truth_links").select("benchmark_query_id,facts(offering_id)").in("benchmark_query_id", activeIds);
    if (!linkResult.error) {
      for (const row of linkResult.data ?? []) {
        const facts = Array.isArray(row.facts) ? row.facts : [row.facts];
        const ids = facts.flatMap(fact => fact?.offering_id ? [String(fact.offering_id)] : []);
        queryOfferingIds[row.benchmark_query_id] = [...new Set([...(queryOfferingIds[row.benchmark_query_id] ?? []), ...ids])];
      }
    }
  }

  const metricRows = (metricRun ? (metricRun.id === latestRun?.id ? latestRows : metricResponse?.rows ?? []) : []) as MetricResult[];
  return {
    businessName: business.name,
    latestRun,
    metricRun,
    results,
    metrics: calculateMonitoringMetrics(queries, metricRows, queryOfferingIds),
  };
}
