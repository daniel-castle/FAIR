import type { HubData } from "../truth-hub";

// Keep context compact, generic, and limited to business data relevant to queries.
export function buildQueryContext(data: HubData) {
  if (!data.business) throw new Error("No demo business is visible in Truth Hub.");
  const facts = data.facts.filter(f => f.verified === true);
  const businessFacts = facts.filter(f => !f.offering_id);
  const factValue = (key: string) => businessFacts.find(f => f.fact_key === key)?.fact_value ?? null;
  return {
    name: data.business.name,
    industry: data.business.industry ?? factValue("industry") ?? factValue("category"),
    template: factValue("business_template") ?? null,
    location: data.business.location ?? factValue("location") ?? factValue("locations"),
    service_area: factValue("service_area") ?? factValue("locations_service_area"),
    offerings: data.offerings.slice(0, 60).map(o => ({
      name: o.name, type: o.offering_type,
      verified_facts: facts.filter(f => f.offering_id === o.id).slice(0, 15).map(f => ({ key: f.fact_key, value: f.fact_value })),
    })),
    verified_business_facts: businessFacts.slice(0, 60).map(f => ({ key: f.fact_key, value: f.fact_value })),
  };
}
