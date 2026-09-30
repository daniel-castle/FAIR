import { z } from "zod";
import type { HubData } from "../truth-hub";
import { friendlyValue } from "../truth-fields";

export const evaluationDimensions = ["visibility", "recommendation", "recommendation_position", "factual_accuracy", "competitor_presence"] as const;
export const dimensionLabels: Record<EvaluationDimension, string> = {
  visibility: "Visibility", recommendation: "Recommendation", recommendation_position: "Recommendation position",
  factual_accuracy: "Fact accuracy", competitor_presence: "Competitor presence",
};
export type EvaluationDimension = typeof evaluationDimensions[number];
export const dimensionsSchema = z.array(z.enum(evaluationDimensions)).min(1).max(5).refine(values => new Set(values).size === values.length, "Choose each dimension once.");
export const evaluationInputSchema = z.object({
  dimensions: dimensionsSchema,
  fact_ids: z.array(z.uuid()).max(100).refine(values => new Set(values).size === values.length),
}).strict();
export const truthSuggestionSchema = z.object({
  fact_key: z.string().min(1).max(200),
  offering_name: z.string().min(1).max(200).nullable(),
}).strict();
export type TruthFact = { id: string; key: string; offering: string | null; value: string; verified: boolean };
export type GenerationBatch = { id: string; created_at: string; query_count: number };

export function truthFactsForBusiness(hub: HubData): TruthFact[] {
  if (!hub.business) return [];
  const offerings = new Map(hub.offerings.filter(row => row.business_id === hub.business!.id).map(row => [row.id, String(row.name)]));
  return hub.facts.filter(fact => fact.business_id === hub.business!.id && (!fact.offering_id || offerings.has(String(fact.offering_id)))).map(fact => ({
    id: fact.id, key: String(fact.fact_key), offering: fact.offering_id ? offerings.get(String(fact.offering_id))! : null,
    value: friendlyValue(fact.fact_value), verified: fact.verified === true,
  }));
}

// Suggestions are identifiers, never expected values. Exact key + unambiguous offering
// matching only; unknown, ambiguous, unverified and cross-business rows stay unlinked.
export function resolveTruthSuggestions(hub: HubData, suggestions: z.infer<typeof truthSuggestionSchema>[]): string[] {
  if (!hub.business) return [];
  const ids = new Set<string>();
  for (const suggestion of suggestions) {
    let offeringId: string | null = null;
    if (suggestion.offering_name !== null) {
      const matches = hub.offerings.filter(row => row.business_id === hub.business!.id && String(row.name).trim().toLowerCase() === suggestion.offering_name!.trim().toLowerCase());
      if (matches.length !== 1) continue;
      offeringId = matches[0].id;
    }
    const facts = hub.facts.filter(fact => fact.business_id === hub.business!.id && fact.verified === true
      && (fact.offering_id ?? null) === offeringId && fact.fact_key === suggestion.fact_key);
    if (facts.length === 1) ids.add(facts[0].id);
  }
  return [...ids];
}
