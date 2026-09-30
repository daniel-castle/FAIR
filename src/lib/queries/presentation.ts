import type { SavedQuery } from "./schema";

export function showsRecommendation(query: Pick<SavedQuery, "evaluation_dimensions">) {
  return (query.evaluation_dimensions ?? []).includes("recommendation");
}

export function showsPosition(query: Pick<SavedQuery, "evaluation_dimensions">) {
  return (query.evaluation_dimensions ?? []).includes("recommendation_position");
}
