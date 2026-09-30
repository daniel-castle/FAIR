"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { loadTruthHub } from "@/app/truth-hub/actions";
import { createSupabaseClient } from "@/lib/supabase/server";
import { decodeFact } from "@/lib/truth-fields";
import { truthFactsForBusiness } from "@/lib/queries/evaluation";
import { benchmarkErrorDetails } from "@/lib/queries/error-log";
import type { Row } from "@/lib/truth-hub";
import { identityAliases } from "@/lib/monitoring/identity";
import { evaluateMonitoredResponse } from "@/lib/monitoring/evaluate";
import {
  MAX_QUERIES_PER_RUN,
  MONITORING_MODEL,
  MONITORING_PROVIDER,
  requestMonitoredAnswer,
} from "@/lib/monitoring/openai";

export type ScanActionResult = { error?: string; message?: string; runId?: string };

function businessAliases(facts: Row[]) {
  const aliasKeys = new Set(["alias", "aliases", "business_alias", "business_aliases", "alternate_names"]);
  return facts.filter(fact => aliasKeys.has(String(fact.fact_key).toLowerCase())).flatMap(fact => {
    const value = decodeFact(fact.fact_value);
    return Array.isArray(value) ? value.map(String) : String(value ?? "").split(/[;,\n]/).map(item => item.trim()).filter(Boolean);
  });
}

export async function runMonitoringScan(): Promise<ScanActionResult> {
  let runId: string | undefined;
  const db = createSupabaseClient();
  if (!db) return { error: "Supabase is not configured." };
  try {
    const hub = await loadTruthHub();
    if (!hub.business || hub.errors.length) return { error: hub.errors.join(" ") || "Load the business in Truth Hub first." };
    if (!process.env.OPENAI_API_KEY) return { error: "Set OPENAI_API_KEY in .env.local and restart the app before running a scan." };

    const queryResult = await db.from("benchmark_queries")
      .select("id,query_text,category,audience,evaluation_dimensions,created_at")
      .eq("business_id", hub.business.id).eq("is_active", true)
      .order("created_at", { ascending: false });
    if (queryResult.error) return { error: "Active benchmark queries could not be loaded." };
    const allQueries = queryResult.data ?? [];
    const selected = [...new Map(allQueries.map(query => [query.category, query])).values()];
    for (const query of allQueries) if (selected.length < MAX_QUERIES_PER_RUN && !selected.some(item => item.id === query.id)) selected.push(query);
    selected.splice(MAX_QUERIES_PER_RUN);
    if (!selected.length) return { error: "Activate at least one benchmark query before running a scan." };

    const runResult = await db.from("monitoring_runs").insert({
      business_id: hub.business.id,
      status: "running",
      query_count: selected.length,
      provider: MONITORING_PROVIDER,
      model: MONITORING_MODEL,
    }).select("id").single();
    if (runResult.error || !runResult.data) {
      const duplicate = runResult.error?.message.includes("monitoring_one_active_run_per_business");
      return { error: duplicate ? "A monitoring run is already in progress." : "Monitoring is not ready. Apply migration 007 and check write access." };
    }
    runId = runResult.data.id;

    const linksResult = await db.from("benchmark_query_truth_links").select("benchmark_query_id,fact_id").in("benchmark_query_id", selected.map(query => query.id));
    if (linksResult.error) throw new Error("Canonical fact links could not be loaded.");
    const allFacts = truthFactsForBusiness(hub);
    const factsById = new Map(allFacts.map(fact => [fact.id, fact]));
    const aliases = identityAliases(String(hub.business.name), businessAliases(hub.facts));

    for (const query of selected) {
      const rawResponse = await requestMonitoredAnswer(query.query_text);
      const stored = await db.from("query_results").insert({
        monitoring_run_id: runId,
        query_id: query.id,
        business_id: hub.business.id,
        ai_platform: MONITORING_PROVIDER,
        provider: MONITORING_PROVIDER,
        model: MONITORING_MODEL,
        tested_at: new Date().toISOString(),
        response_text: rawResponse,
        raw_response_text: rawResponse,
        mentioned: false,
        recommended: false,
        recommendation_position: null,
        mentioned_businesses: [],
        claims_checked: 0,
        verified_claims: 0,
        conflict_count: 0,
      }).select("id").single();
      if (stored.error || !stored.data) throw new Error("A raw monitoring response could not be persisted.");

      const factIds = (linksResult.data ?? []).filter(link => link.benchmark_query_id === query.id).map(link => link.fact_id);
      const linkedFacts = factIds.flatMap(id => factsById.get(id) ?? []);
      const evidence = evaluateMonitoredResponse({
        rawResponse,
        businessName: String(hub.business.name),
        aliases,
        linkedFacts,
        evaluateFacts: (query.evaluation_dimensions ?? []).includes("factual_accuracy"),
      });
      const claims = evidence.claims;
      if (claims.length) {
        const claimsResult = await db.from("response_claims").insert(claims.map(claim => ({
          result_id: stored.data.id,
          fact_id: claim.fact_id,
          subject: claim.subject,
          offering: claim.offering,
          fact_key: claim.fact_key,
          observed_value: claim.value,
          canonical_value_snapshot: claim.canonical_value_snapshot,
          verification_status: claim.verification_status,
          evidence_text: claim.evidence_text,
        }))).select("id");
        if (claimsResult.error || claimsResult.data?.length !== claims.length) throw new Error("Fact comparison evidence could not be persisted.");
      }
      const checked = claims.filter(claim => claim.verification_status !== "needs_review");
      const verified = checked.filter(claim => claim.verification_status === "verified").length;
      const conflicts = checked.filter(claim => claim.verification_status === "conflict").length;
      const updated = await db.from("query_results").update({
        mentioned: evidence.mentioned,
        recommended: evidence.recommended,
        recommendation_position: evidence.recommendation_position,
        mentioned_businesses: evidence.mentioned_businesses,
        claims_checked: checked.length,
        verified_claims: verified,
        conflict_count: conflicts,
      }).eq("id", stored.data.id).eq("business_id", hub.business.id).select("id").single();
      if (updated.error) throw new Error("Deterministic result evidence could not be finalized.");
    }

    const completed = await db.from("monitoring_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", runId).eq("business_id", hub.business.id).select("id").single();
    if (completed.error) throw new Error("The monitoring run could not be marked complete.");
    revalidatePath("/");
    revalidatePath("/metrics");
    revalidatePath("/queries");
    return { runId, message: `Benchmark complete · ${selected.length} questions tested` };
  } catch (caught) {
    console.error("Monitoring scan failed:", benchmarkErrorDetails(caught));
    if (runId) await db.from("monitoring_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: "The scan stopped before all selected queries were completed." }).eq("id", runId);
    revalidatePath("/metrics");
    return { runId, error: "The scan stopped before completion. Saved raw responses and evidence remain available for inspection." };
  }
}

const localFactSchema = z.object({
  id: z.uuid(), key: z.string().min(1).max(200), offering: z.string().max(200).nullable(),
  value: z.string().max(20000), verified: z.boolean(),
}).strict();
const localQuerySchema = z.object({
  id: z.uuid(), query_text: z.string().min(10).max(500), category: z.string().min(1).max(120),
  audience: z.string().min(1).max(120), evaluation_dimensions: z.array(z.enum(["visibility", "recommendation", "recommendation_position", "factual_accuracy", "competitor_presence"])).max(5),
  linked_facts: z.array(localFactSchema).max(100),
}).strict();
const localScanSchema = z.object({
  business: z.object({ id: z.uuid(), name: z.string().min(1).max(200), aliases: z.array(z.string().min(1).max(200)).max(20) }).strict(),
  queries: z.array(localQuerySchema).min(1).max(MAX_QUERIES_PER_RUN),
}).strict();

export async function runWorkspaceMonitoringScan(snapshot: unknown) {
  const parsed = localScanSchema.safeParse(snapshot);
  if (!parsed.success) return { error: "The browser monitoring snapshot is invalid." };
  if (!process.env.OPENAI_API_KEY) return { error: "Set OPENAI_API_KEY in the server environment before running a scan." };

  const startedAt = new Date().toISOString();
  const runId = crypto.randomUUID();
  const aliases = identityAliases(parsed.data.business.name, parsed.data.business.aliases);
  const results = [];
  const allClaims = [];
  try {
    for (const query of parsed.data.queries) {
      const rawResponse = await requestMonitoredAnswer(query.query_text);
      const resultId = crypto.randomUUID();
      const testedAt = new Date().toISOString();
      const evidence = evaluateMonitoredResponse({
        rawResponse,
        businessName: parsed.data.business.name,
        aliases,
        linkedFacts: query.linked_facts,
        evaluateFacts: query.evaluation_dimensions.includes("factual_accuracy"),
      });
      const claims = evidence.claims.map(claim => ({
        id: crypto.randomUUID(), result_id: resultId, fact_id: claim.fact_id,
        subject: claim.subject, offering: claim.offering, fact_key: claim.fact_key,
        observed_value: claim.value, canonical_value_snapshot: claim.canonical_value_snapshot,
        verification_status: claim.verification_status, evidence_text: claim.evidence_text, created_at: testedAt,
      }));
      const checked = claims.filter(claim => claim.verification_status !== "needs_review");
      const verified = checked.filter(claim => claim.verification_status === "verified").length;
      const conflicts = checked.filter(claim => claim.verification_status === "conflict").length;
      allClaims.push(...claims);
      results.push({
        id: resultId, monitoring_run_id: runId, query_id: query.id, business_id: parsed.data.business.id,
        provider: MONITORING_PROVIDER, model: MONITORING_MODEL, tested_at: testedAt, raw_response_text: rawResponse,
        mentioned: evidence.mentioned, recommended: evidence.recommended, recommendation_position: evidence.recommendation_position,
        mentioned_businesses: evidence.mentioned_businesses, claims_checked: checked.length, verified_claims: verified,
        conflict_count: conflicts, query_text: query.query_text, category: query.category, audience: query.audience, claims,
      });
    }
    const completedAt = new Date().toISOString();
    return {
      run: { id: runId, business_id: parsed.data.business.id, status: "completed" as const, started_at: startedAt, completed_at: completedAt, query_count: results.length, provider: MONITORING_PROVIDER, model: MONITORING_MODEL, error_message: null },
      results,
      claims: allClaims,
      message: `Benchmark complete · ${results.length} questions tested`,
    };
  } catch (caught) {
    console.error("Workspace monitoring scan failed:", benchmarkErrorDetails(caught));
    return { error: "The scan stopped before completion. Existing browser workspace history was not changed." };
  }
}
