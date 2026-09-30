import type { SavedQuery } from "./schema";

// Called by the server loader. Extraction and canonical comparison must supply
// these evidence fields; an AI-generated score is never an input to FAIR metrics.
export function calculateQueryMetrics(queries: SavedQuery[]) {
  const results = queries.flatMap(query => query.results.slice(0, 1));
  const mentioned = results.filter(result => result.mentioned);
  const positions = mentioned.flatMap(result => result.recommendation_position === null ? [] : [result.recommendation_position]);
  const claimsChecked = results.reduce((sum, result) => sum + result.claims_checked, 0);
  const verifiedClaims = results.reduce((sum, result) => sum + result.verified_claims, 0);
  return {
    totalQueries: queries.length,
    activeQueries: queries.filter(query => query.is_active).length,
    testedQueries: results.length,
    mentionRate: results.length ? mentioned.length / results.length * 100 : null,
    topRecommendationRate: results.length ? results.filter(result => result.mentioned && result.recommendation_position === 1).length / results.length * 100 : null,
    averagePosition: positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : null,
    averageAccuracy: claimsChecked ? verifiedClaims / claimsChecked * 100 : null,
    testCoverage: results.length && queries.length ? results.length / queries.length * 100 : null,
  };
}
