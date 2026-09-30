export type MetricQuery = { id: string; category: string; audience: string; is_active: boolean };
export type MetricResult = {
  id: string;
  query_id: string;
  mentioned: boolean;
  recommended: boolean;
  recommendation_position: number | null;
  claims_checked: number;
  verified_claims: number;
  conflict_count: number;
};

export type MetricClaim = { id: string; result_id: string; verification_status: "verified" | "conflict" | "needs_review" };
export type MetricReview = { claim_id: string; human_status: "verified" | "conflict" | "needs_review"; resolved: boolean };

function percent(numerator: number, denominator: number) {
  return denominator ? numerator / denominator * 100 : null;
}

function groupedVisibility(results: MetricResult[], queries: MetricQuery[], field: "category" | "audience") {
  const queryById = new Map(queries.map(query => [query.id, query]));
  const groups = new Map<string, { tested: number; mentioned: number }>();
  for (const result of results) {
    const label = queryById.get(result.query_id)?.[field];
    if (!label) continue;
    const current = groups.get(label) ?? { tested: 0, mentioned: 0 };
    current.tested += 1;
    current.mentioned += result.mentioned ? 1 : 0;
    groups.set(label, current);
  }
  return [...groups.entries()].map(([label, counts]) => ({ label, ...counts, mentionRate: percent(counts.mentioned, counts.tested)! }))
    .sort((a, b) => b.tested - a.tested || a.label.localeCompare(b.label));
}

export function calculateMonitoringMetrics(
  queries: MetricQuery[],
  results: MetricResult[],
  queryOfferingIds: Record<string, string[]> = {},
  claims?: MetricClaim[],
  reviews: MetricReview[] = [],
) {
  const active = queries.filter(query => query.is_active);
  const activeIds = new Set(active.map(query => query.id));
  const currentResults = results.filter(result => activeIds.has(result.query_id));
  const testedIds = new Set(currentResults.map(result => result.query_id));
  const positions = currentResults.flatMap(result => result.recommendation_position === null ? [] : [result.recommendation_position]);
  const currentResultIds = new Set(currentResults.map(result => result.id));
  const reviewByClaim = new Map(reviews.map(review => [review.claim_id, review]));
  const currentClaims = claims?.filter(claim => currentResultIds.has(claim.result_id));
  const finalStatuses = currentClaims && (currentClaims.length > 0 || currentResults.every(result => result.claims_checked === 0)) ? currentClaims.map(claim => {
    const review = reviewByClaim.get(claim.id);
    return review?.resolved && review.human_status !== "needs_review" ? review.human_status : claim.verification_status;
  }) : undefined;
  const claimsChecked = finalStatuses ? finalStatuses.filter(status => status !== "needs_review").length : currentResults.reduce((sum, result) => sum + result.claims_checked, 0);
  const verifiedClaims = finalStatuses ? finalStatuses.filter(status => status === "verified").length : currentResults.reduce((sum, result) => sum + result.verified_claims, 0);
  const conflicts = finalStatuses ? finalStatuses.filter(status => status === "conflict").length : currentResults.reduce((sum, result) => sum + result.conflict_count, 0);
  const benchmarkedOfferings = new Set(active.flatMap(query => queryOfferingIds[query.id] ?? []));
  const testedOfferings = new Set(currentResults.flatMap(result => queryOfferingIds[result.query_id] ?? []));

  return {
    activeQueries: active.length,
    testedQueries: testedIds.size,
    mentionRate: percent(currentResults.filter(result => result.mentioned).length, currentResults.length),
    recommendationRate: percent(currentResults.filter(result => result.recommended).length, currentResults.length),
    topRecommendationRate: percent(currentResults.filter(result => result.recommendation_position === 1).length, currentResults.length),
    averagePosition: positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : null,
    factAccuracy: percent(verifiedClaims, claimsChecked),
    conflictRate: percent(conflicts, claimsChecked),
    testCoverage: percent(testedIds.size, active.length),
    claimsChecked,
    verifiedClaims,
    conflicts,
    categoryVisibility: groupedVisibility(currentResults, active, "category"),
    audienceVisibility: groupedVisibility(currentResults, active, "audience"),
    offeringCoverage: {
      benchmarked: benchmarkedOfferings.size,
      tested: testedOfferings.size,
      percentage: percent(testedOfferings.size, benchmarkedOfferings.size),
    },
  };
}

export type MonitoringMetrics = ReturnType<typeof calculateMonitoringMetrics>;
