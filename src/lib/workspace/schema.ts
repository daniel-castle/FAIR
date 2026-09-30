export const WORKSPACE_STORAGE_KEY = "fair_workspace_v1";
export const WORKSPACE_VERSION = 1 as const;

export type WorkspaceMode = "demo" | "blank";

export type WorkspaceRow = {
  id: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type FairWorkspace = {
  version: typeof WORKSPACE_VERSION;
  mode: WorkspaceMode;
  createdAt: string;
  updatedAt: string;
  truthHub: {
    business: WorkspaceRow;
    offerings: WorkspaceRow[];
    facts: WorkspaceRow[];
    sources: WorkspaceRow[];
  };
  queries: {
    items: WorkspaceRow[];
    batches: WorkspaceRow[];
  };
  monitoring: {
    runs: WorkspaceRow[];
    results: WorkspaceRow[];
    claims: WorkspaceRow[];
  };
  insights: WorkspaceRow[];
};

export function isFairWorkspace(value: unknown): value is FairWorkspace {
  if (!value || typeof value !== "object") return false;
  const workspace = value as Partial<FairWorkspace>;
  return workspace.version === WORKSPACE_VERSION
    && (workspace.mode === "demo" || workspace.mode === "blank")
    && typeof workspace.createdAt === "string"
    && typeof workspace.updatedAt === "string"
    && !!workspace.truthHub?.business
    && Array.isArray(workspace.truthHub.offerings)
    && Array.isArray(workspace.truthHub.facts)
    && Array.isArray(workspace.truthHub.sources)
    && Array.isArray(workspace.queries?.items)
    && Array.isArray(workspace.queries?.batches)
    && Array.isArray(workspace.monitoring?.runs)
    && Array.isArray(workspace.monitoring?.results)
    && Array.isArray(workspace.monitoring?.claims)
    && Array.isArray(workspace.insights);
}
