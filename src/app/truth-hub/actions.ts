"use server";

import { createSupabaseClient } from "@/lib/supabase/server";
import { findTemplate, offeringFields } from "@/data/business-templates";
import { findFact, normalizeField } from "@/lib/truth-fields";
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
  if (input.table === "facts" && !input.remove) values.updated_at = new Date().toISOString();
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

export async function saveGuidedField(input: { templateId: string; key: string; value: unknown; offeringId?: string; verified: boolean; custom?: boolean }) {
  const template = findTemplate(input.templateId);
  const field = template.fields.find(f => f.key === input.key && f.scope === (input.offeringId ? "offering" : "business"));
  if (!field) return { error: "Choose a field from your business template." };
  let value: string;
  try {
    value = input.custom ? String(input.value).trim() : normalizeField(field, input.value);
    if (!value || value.length > 20000) throw new Error("Enter a value of up to 20,000 characters.");
  } catch (error) { return { error: error instanceof Error ? error.message : "Check the field value." }; }
  const hub = await loadTruthHub();
  if (!hub.business || hub.errors.length) return { error: "Business information could not be loaded. Reload before saving." };
  const existing = findFact(hub.facts, field, input.offeringId);
  return saveTruthHub({ table: "facts", id: existing?.id, values: { fact_key: existing?.fact_key ?? field.key, fact_value: value, verified: input.verified === true, offering_id: input.offeringId ?? null } });
}

export async function saveGuidedOffering(input: { templateId: string; id?: string; name: string; type: string; description: string; values: Record<string, unknown>; verified: boolean }): Promise<{ error?: string; row?: Row }> {
  if (!input.name.trim() || input.name.length > 200 || !["product", "service", "menu_item"].includes(input.type)) return { error: "Enter a name and choose Product, Service, or Menu item." };
  const fields = offeringFields(findTemplate(input.templateId), input.type);
  const entries: { key: string; value: string }[] = [];
  try {
    for (const [key, value] of Object.entries(input.values)) {
      const field = fields.find(f => f.key === key);
      if (!field) throw new Error("This field is not available for the selected offering.");
      entries.push({ key, value: normalizeField(field, value) });
    }
  } catch (error) { return { error: error instanceof Error ? error.message : "Check the offering details." }; }
  const saved = await saveTruthHub({ table: "offerings", id: input.id, values: { name: input.name.trim(), offering_type: input.type, description: input.description.trim() } });
  if (saved.error || !saved.row) return saved;
  // Keep the offering ID if a later write fails, so retry edits this offering instead of duplicating it.
  const hub = await loadTruthHub();
  if (!hub.business || hub.errors.length) return { row: saved.row, error: "Offering saved, but details could not be loaded. Reload and continue editing this offering." };
  const db = createSupabaseClient()!;
  const rows = entries.map(({ key, value }) => {
    const field = fields.find(f => f.key === key)!;
    const existing = findFact(hub.facts, field, saved.row!.id);
    return { id: existing?.id ?? crypto.randomUUID(), business_id: hub.business!.id, offering_id: saved.row!.id, source_id: existing?.source_id ?? null, fact_key: existing?.fact_key ?? key, fact_value: value, verified: input.verified === true, updated_at: new Date().toISOString() };
  });
  if (rows.length) {
    const result = await db.from("facts").upsert(rows, { onConflict: "id" }).select("id");
    if (result.error || result.data?.length !== rows.length) return { row: saved.row, error: `Offering saved, but its details were not confirmed. ${result.error?.message ?? "Check facts write access."} Open Edit to retry without creating another offering.` };
  }
  return saved;
}
