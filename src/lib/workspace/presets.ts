import { WORKSPACE_VERSION, type FairWorkspace, type WorkspaceMode, type WorkspaceRow } from "./schema";

const DEMO_BUSINESS_ID = "10000000-0000-4000-8000-000000000001";

function baseWorkspace(mode: WorkspaceMode, business: WorkspaceRow): FairWorkspace {
  const now = new Date().toISOString();
  return {
    version: WORKSPACE_VERSION,
    mode,
    createdAt: now,
    updatedAt: now,
    truthHub: { business, offerings: [], facts: [], sources: [] },
    queries: { items: [], batches: [] },
    monitoring: { runs: [], results: [], claims: [], reviews: [], recommendations: [], specialist_review_requests: [] },
    insights: [],
  };
}

export function createBlankWorkspace(): FairWorkspace {
  return baseWorkspace("blank", {
    id: crypto.randomUUID(),
    name: "My Business",
    industry: "",
    created_at: new Date().toISOString(),
  });
}

export function createDemoWorkspace(): FairWorkspace {
  const homepageSourceId = "40000000-0000-4000-8000-000000000001";
  const menuSourceId = "40000000-0000-4000-8000-000000000002";
  const contactSourceId = "40000000-0000-4000-8000-000000000003";
  const preorderSourceId = "40000000-0000-4000-8000-000000000004";
  const value = (input: unknown) => typeof input === "string" ? input : JSON.stringify(input);
  const factId = (index: number) => `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  let factIndex = 0;
  const fact = (fact_key: string, fact_value: unknown, source_id: string, offering_id: string | null = null): WorkspaceRow => ({
    id: factId(++factIndex), business_id: DEMO_BUSINESS_ID, offering_id, source_id,
    fact_key, fact_value: value(fact_value), verified: true, updated_at: "2026-09-30T00:00:00.000Z",
  });
  const workspace = baseWorkspace("demo", {
    id: DEMO_BUSINESS_ID,
    name: "Franklin Barbecue",
    industry: "Barbecue restaurant",
    created_at: "2026-01-01T00:00:00.000Z",
  });
  const offeringData = [
    ["Brisket", "$42/lb", "Smoked USDA Prime brisket", "Smoked meat"],
    ["Pork Spare Ribs", "$34/lb", "Smoked heritage Duroc pork spare ribs", "Smoked meat"],
    ["Pulled Pork", "$32/lb", "Smoked pulled pork", "Smoked meat"],
    ["Turkey", "$32/lb", "Smoked turkey", "Smoked meat"],
    ["Sausage", "$6/link or $26/lb", "Smoked sausage", "Smoked meat"],
    ["Jalapeño Cheddar Sausage", "$6/link or $26/lb", "Jalapeño cheddar sausage", "Smoked meat"],
    ["Beef Rib", "$44/lb", "Beef rib available Friday through Sunday", "Smoked meat"],
    ["Brisket Sandwich", "$21", "Brisket sandwich", "Sandwich"],
    ["Pulled Pork Sandwich", "$16", "Pulled pork sandwich", "Sandwich"],
    ["Turkey Sandwich", "$16", "Turkey sandwich", "Sandwich"],
    ["Tipsy Texan Sandwich", "$18", "Tipsy Texan sandwich", "Sandwich"],
    ["Chopped Beef Sandwich", "$9", "Chopped beef sandwich", "Sandwich"],
    ["Potato Salad", "$5 single / $7.40 pint / $14 quart", "Potato salad offered in three sizes", "Side"],
    ["Slaw", "$5 single / $7.40 pint / $14 quart", "Slaw offered in three sizes", "Side"],
    ["Pinto Beans", "$5 single / $7.40 pint / $14 quart", "Pinto beans offered in three sizes", "Side"],
  ] as const;
  workspace.truthHub.offerings = offeringData.map(([name, , description], index) => ({
    id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    business_id: DEMO_BUSINESS_ID, name, offering_type: "menu_item", description,
    created_at: "2026-09-30T00:00:00.000Z", updated_at: "2026-09-30T00:00:00.000Z",
  }));
  workspace.truthHub.sources = [
    { id: homepageSourceId, business_id: DEMO_BUSINESS_ID, name: "Franklin Barbecue homepage", source_type: "website", url: "https://franklinbbq.com/", status: "current" },
    { id: menuSourceId, business_id: DEMO_BUSINESS_ID, name: "Franklin Barbecue menu", source_type: "website", url: "https://franklinbbq.com/menu", status: "current" },
    { id: contactSourceId, business_id: DEMO_BUSINESS_ID, name: "Franklin Barbecue contact", source_type: "website", url: "https://franklinbbq.com/contact", status: "current" },
    { id: preorderSourceId, business_id: DEMO_BUSINESS_ID, name: "Franklin Barbecue preorder", source_type: "website", url: "https://preorder.franklinbbq.com/information", status: "current" },
  ];
  workspace.truthHub.facts = [
    fact("business_template", "restaurant", homepageSourceId),
    fact("description", "Barbecue restaurant specializing in Central Texas barbecue, brisket, ribs, pulled pork, turkey, and sausage.", homepageSourceId),
    fact("location", { kind: "location", street: "900 E 11th St", city: "Austin", region: "TX", postal_code: "78702" }, contactSourceId),
    fact("area_location_context", "East Austin, Austin, Texas", homepageSourceId),
    fact("phone", "(512) 653-1187", contactSourceId),
    fact("website", "https://franklinbbq.com/", homepageSourceId),
    fact("hours", "Tuesday–Sunday 11:00 AM until sold out, typically around 2–3 PM; Monday closed", homepageSourceId),
    fact("cuisine", ["Central Texas barbecue"], menuSourceId),
    fact("service_options", ["Dine-in", "Takeout"], homepageSourceId),
    fact("dine_in", true, homepageSourceId),
    fact("takeout", true, preorderSourceId),
    fact("ordering_url", "https://preorder.franklinbbq.com/", preorderSourceId),
    fact("specialties", ["Central Texas barbecue", "Brisket", "Ribs", "Pulled pork", "Turkey", "Sausage"], menuSourceId),
    fact("advance_preorder_takeout", true, preorderSourceId),
    fact("preorder_availability", "Orders available up to 56 days ahead", preorderSourceId),
    fact("preorder_meat_minimum", "5 lb", preorderSourceId),
    fact("preorder_meat_maximum", "30 lb", preorderSourceId),
    fact("patio", true, homepageSourceId),
    fact("friendly_dogs_allowed_on_patio", true, homepageSourceId),
  ];
  for (const [index, offering] of workspace.truthHub.offerings.entries()) {
    const [, price, , category] = offeringData[index];
    workspace.truthHub.facts.push(
      fact("category", category, menuSourceId, offering.id),
      fact("price", price, menuSourceId, offering.id),
      fact("availability", index === 6 ? "Limited availability" : "Available", menuSourceId, offering.id),
    );
    if (index === 0) workspace.truthHub.facts.push(fact("ingredients", ["USDA Prime brisket"], menuSourceId, offering.id));
    if (index === 1) workspace.truthHub.facts.push(fact("ingredients", ["Heritage Duroc pork"], menuSourceId, offering.id));
    if (index === 6) workspace.truthHub.facts.push(fact("available_hours", "Friday–Sunday", menuSourceId, offering.id));
  }
  return workspace;
}
