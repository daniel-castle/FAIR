import type { HumanReview, ResponseClaim, SpecialistRecommendation, SpecialistReviewRequest } from "@/lib/monitoring/schema";
import type { SavedQuery } from "@/lib/queries/schema";
import { buildWorkspaceMonitoringData } from "./monitoring";
import type { FairWorkspace } from "./schema";

export type HumanReviewItem = { claim: ResponseClaim; review: HumanReview | null; query: SavedQuery | null; queryText: string; rawResponse: string; businessName: string };

export function humanReviewItems(workspace: FairWorkspace): HumanReviewItem[] {
  const claims = workspace.monitoring.claims as unknown as ResponseClaim[];
  const reviews = (workspace.monitoring.reviews ?? []) as unknown as HumanReview[];
  const results = new Map(workspace.monitoring.results.map(result => [result.id, result]));
  const queries = new Map((workspace.queries.items as unknown as SavedQuery[]).map(query => [query.id, query]));
  const reviewByClaim = new Map(reviews.map(review => [review.claim_id, review]));
  return claims.flatMap(claim => {
    if (claim.verification_status !== "needs_review" && claim.verification_status !== "conflict") return [];
    const result = results.get(claim.result_id);
    if (!result) return [];
    return [{ claim, review: reviewByClaim.get(claim.id) ?? null, query: queries.get(String(result.query_id)) ?? null, queryText: String(result.query_text ?? "Benchmark question unavailable"), rawResponse: String(result.raw_response_text ?? ""), businessName: String(workspace.truthHub.business.name || "This business") }];
  }).sort((a, b) => Number(!!a.review?.resolved) - Number(!!b.review?.resolved) || (a.claim.verification_status === "needs_review" ? -1 : 1));
}

export function saveHumanReview(workspace: FairWorkspace, review: HumanReview): FairWorkspace {
  const reviews = workspace.monitoring.reviews ?? [];
  return { ...workspace, monitoring: { ...workspace.monitoring, reviews: [review, ...reviews.filter(item => item.claim_id !== review.claim_id)] } };
}

export type GuidanceEvidence = { id: string; label: string; detail: string; severity: "default" | "warning" };

export function specialistGuidanceEvidence(workspace: FairWorkspace): GuidanceEvidence[] {
  const metrics = buildWorkspaceMonitoringData(workspace).metrics;
  const items = humanReviewItems(workspace);
  const unresolvedConflicts = items.filter(item => item.claim.verification_status === "conflict" && !item.review?.resolved).length;
  const needsReview = items.filter(item => item.claim.verification_status === "needs_review" && !item.review?.resolved).length;
  const evidence: GuidanceEvidence[] = [];
  if (metrics.mentionRate !== null || metrics.recommendationRate !== null || metrics.factAccuracy !== null) evidence.push({ id: "latest-metrics", label: "Latest FAIR metrics", detail: `Mention rate ${metrics.mentionRate?.toFixed(1) ?? "—"}%; recommendation rate ${metrics.recommendationRate?.toFixed(1) ?? "—"}%; fact accuracy ${metrics.factAccuracy?.toFixed(1) ?? "—"}%; conflict rate ${metrics.conflictRate?.toFixed(1) ?? "—"}%.`, severity: "default" });
  if (unresolvedConflicts) evidence.push({ id: "unresolved-conflicts", label: "Unresolved conflicts", detail: `${unresolvedConflicts} machine-identified ${unresolvedConflicts === 1 ? "conflict requires" : "conflicts require"} human judgment.`, severity: "warning" });
  if (needsReview) evidence.push({ id: "needs-review", label: "Needs-review claims", detail: `${needsReview} ${needsReview === 1 ? "claim is" : "claims are"} awaiting a confident interpretation.`, severity: "warning" });
  if (metrics.mentionRate !== null && metrics.mentionRate < 60) evidence.push({ id: "mention-rate", label: "Low mention rate", detail: `${metrics.mentionRate.toFixed(1)}% across the latest completed benchmark.`, severity: "warning" });
  if (metrics.recommendationRate !== null && metrics.recommendationRate < 60) evidence.push({ id: "recommendation-rate", label: "Low recommendation rate", detail: `${metrics.recommendationRate.toFixed(1)}% across the latest completed benchmark.`, severity: "warning" });
  for (const row of metrics.categoryVisibility.filter(row => row.mentionRate < 60)) evidence.push({ id: `category:${row.label}`, label: `${row.label} visibility`, detail: `${row.mentionRate.toFixed(1)}% mention rate across ${row.tested} tested ${row.tested === 1 ? "query" : "queries"}.`, severity: "warning" });
  if (metrics.offeringCoverage.benchmarked > 0) evidence.push({ id: "offering-coverage", label: "Offering coverage", detail: `${metrics.offeringCoverage.tested} of ${metrics.offeringCoverage.benchmarked} linked offerings tested (${metrics.offeringCoverage.percentage?.toFixed(1) ?? "0"}%).`, severity: metrics.offeringCoverage.percentage !== null && metrics.offeringCoverage.percentage < 60 ? "warning" : "default" });
  if (!evidence.length) evidence.push({ id: "no-actionable-signal", label: "No actionable benchmark signal yet", detail: "Run a benchmark or collect more comparable evidence before creating evidence-tied guidance.", severity: "default" });
  return evidence;
}

export function saveSpecialistRecommendation(workspace: FairWorkspace, recommendation: SpecialistRecommendation): FairWorkspace {
  const recommendations = workspace.monitoring.recommendations ?? [];
  return { ...workspace, monitoring: { ...workspace.monitoring, recommendations: [recommendation, ...recommendations.filter(item => item.id !== recommendation.id)] } };
}

export function saveSpecialistReviewRequest(workspace: FairWorkspace, request: SpecialistReviewRequest): FairWorkspace {
  return { ...workspace, monitoring: { ...workspace.monitoring, specialist_review_requests: [request] } };
}
