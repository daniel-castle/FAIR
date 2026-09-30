"use server";

import { createSupabaseClient } from "@/lib/supabase/server";
import type { HubData, Row } from "@/lib/truth-hub";

export async function loadTruthHub(): Promise<HubData> {
  const db = createSupabaseClient();
  const empty: HubData = { business: null, offerings: [], facts: [], sources: [], errors: [] };
  if (!db) return { ...empty, errors: ["Supabase configuration is missing."] };
  const { data: business, error } = await db.from("businesses").select("*").order("created_at").limit(1).maybeSingle();
  if (error || !business) return { ...empty, errors: [error?.message ?? "No demo business is visible. Check the connected project, seed data, and Supabase SELECT policies."] };
  const tables = ["offerings", "facts", "sources"] as const;
  const results = await Promise.all(tables.map(table => db.from(table).select("*").eq("business_id", business.id)));
  return { business, offerings: results[0].data ?? [], facts: results[1].data ?? [], sources: results[2].data ?? [], errors: results.flatMap((r, i) => r.error ? [`Unable to load ${tables[i]}: ${r.error.message}`] : []) };
}

type Mutation = { table: "businesses" | "offerings" | "facts" | "sources"; id?: string; remove?: boolean; values?: Record<string, unknown> };
export async function saveTruthHub(input: Mutation): Promise<{ error?: string; row?: Row }> {
  const db = createSupabaseClient();
  if (!db) return { error: "Supabase configuration is missing." };
  // Resolve the demo business on the server; never trust a submitted business ID.
  const { data: business, error } = await db.from("businesses").select("id").order("created_at").limit(1).maybeSingle();
  if (error || !business) return { error: error?.message ?? "No writable demo business is visible." };
  const allowed = { businesses: ["name"], offerings: ["name", "offering_type", "description"], facts: ["fact_key", "fact_value", "verified", "offering_id"], sources: ["name", "source_type", "url", "status"] };
  if (!Object.hasOwn(allowed, input.table)) return { error: "Unsupported record type." };
  const values = Object.fromEntries(Object.entries(input.values ?? {}).filter(([key]) => allowed[input.table].includes(key)));
  if (input.remove && !input.id) return { error: "Select a record to delete." };
  if (input.table === "businesses" && (input.id !== business.id || input.remove)) return { error: "Invalid business update." };
  if (!input.remove && !input.id && !(values.name || values.fact_key)) return { error: "A name or fact key is required." };
  if (values.offering_id) {
    const { data } = await db.from("offerings").select("id").eq("business_id", business.id).eq("id", values.offering_id).maybeSingle();
    if (!data) return { error: "This offering is not available for the current business." };
  }
  const query = input.remove ? db.from(input.table).delete() : input.id ? db.from(input.table).update(values) : db.from(input.table).insert({ ...values, business_id: business.id });
  const scoped = input.id ? query.eq("id", input.id).eq(input.table === "businesses" ? "id" : "business_id", business.id) : query;
  const result = await scoped.select("*").single();
  if (result.error) return { error: `Could not save: ${result.error.message}. Check the table’s write policy and required fields.` };
  return { row: result.data as Row };
}
