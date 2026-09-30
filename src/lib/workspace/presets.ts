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
    monitoring: { runs: [], results: [], claims: [] },
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
  const workspace = baseWorkspace("demo", {
    id: DEMO_BUSINESS_ID,
    name: "Franklin Barbecue",
    industry: "Restaurant",
    location: "Austin, Texas",
    created_at: "2026-01-01T00:00:00.000Z",
  });
  workspace.truthHub.offerings = [
    { id: "20000000-0000-4000-8000-000000000001", business_id: DEMO_BUSINESS_ID, name: "Brisket", offering_type: "menu_item", description: "Texas-style smoked brisket" },
    { id: "20000000-0000-4000-8000-000000000002", business_id: DEMO_BUSINESS_ID, name: "Pork Ribs", offering_type: "menu_item", description: "Smoked pork ribs" },
  ];
  workspace.truthHub.facts = [
    { id: "30000000-0000-4000-8000-000000000001", business_id: DEMO_BUSINESS_ID, offering_id: null, fact_key: "business_template", fact_value: "restaurant", verified: true },
    { id: "30000000-0000-4000-8000-000000000002", business_id: DEMO_BUSINESS_ID, offering_id: null, fact_key: "city", fact_value: "Austin, Texas", verified: true },
    { id: "30000000-0000-4000-8000-000000000003", business_id: DEMO_BUSINESS_ID, offering_id: null, fact_key: "service_model", fact_value: "Counter service", verified: true },
  ];
  workspace.truthHub.sources = [
    { id: "40000000-0000-4000-8000-000000000001", business_id: DEMO_BUSINESS_ID, name: "Official website", source_type: "website", url: "https://franklinbbq.com", status: "verified" },
  ];
  return workspace;
}
