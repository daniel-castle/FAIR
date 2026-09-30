import { calculateMonitoringMetrics, type MonitoringMetrics } from "@/lib/metrics/monitoring";
import type { MonitoringResult, MonitoringRun, ResponseClaim } from "@/lib/monitoring/schema";
import type { SavedQuery } from "@/lib/queries/schema";
import type { FairWorkspace } from "./schema";

export type WorkspaceMonitoringData = {
  businessName: string;
  latestRun: MonitoringRun | null;
  metricRun: MonitoringRun | null;
  results: MonitoringResult[];
  metrics: MonitoringMetrics;
};

function offeringLinks(workspace: FairWorkspace, queries: SavedQuery[]) {
  const idsByName = new Map(workspace.truthHub.offerings.map(offering => [String(offering.name), offering.id]));
  return Object.fromEntries(queries.map(query => [query.id, [...new Set((query.truth_links ?? []).flatMap(fact => fact.offering && idsByName.has(fact.offering) ? [idsByName.get(fact.offering)!] : []))]]));
}

export function buildWorkspaceMonitoringData(workspace: FairWorkspace): WorkspaceMonitoringData {
  const queries = workspace.queries.items as unknown as SavedQuery[];
  const runs = workspace.monitoring.runs as unknown as MonitoringRun[];
  const storedResults = workspace.monitoring.results as unknown as MonitoringResult[];
  const storedClaims = workspace.monitoring.claims as unknown as ResponseClaim[];
  const latestRun = runs[0] ?? null;
  const metricRun = runs.find(run => run.status === "completed") ?? null;
  const latestRows = latestRun ? storedResults.filter(result => result.monitoring_run_id === latestRun.id) : [];
  const results = latestRows.map(result => ({ ...result, claims: storedClaims.filter(claim => claim.result_id === result.id) }));
  const metricRows = metricRun ? storedResults.filter(result => result.monitoring_run_id === metricRun.id) : [];
  return {
    businessName: String(workspace.truthHub.business.name || "your business"),
    latestRun,
    metricRun,
    results,
    metrics: calculateMonitoringMetrics(queries, metricRows, offeringLinks(workspace, queries)),
  };
}

export type PresenceHistoryPoint = { runId: string; date: string; mentionRate: number | null; recommendationRate: number | null; factAccuracy: number | null };

export function workspacePresenceHistory(workspace: FairWorkspace): PresenceHistoryPoint[] {
  return workspace.monitoring.runs.flatMap(run => {
    if (run.status !== "completed" || typeof run.started_at !== "string") return [];
    const snapshot = run.metric_snapshot as MonitoringMetrics | undefined;
    if (!snapshot) return [];
    return [{ runId: run.id, date: run.started_at, mentionRate: snapshot.mentionRate, recommendationRate: snapshot.recommendationRate, factAccuracy: snapshot.factAccuracy }];
  }).reverse();
}
