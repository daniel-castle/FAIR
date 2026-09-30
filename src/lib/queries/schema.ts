import { z } from "zod";
import { dimensionsSchema, truthSuggestionSchema, type EvaluationDimension, type GenerationBatch, type TruthFact } from "./evaluation";
import type { QueryAnalysis } from "./analysis-schema";

export const queryCategories = [
  "Direct product/service search", "Category discovery", "Budget/value",
  "Location", "Audience/persona", "Feature/specialty", "Comparison",
] as const;

export const benchmarkQuerySchema = z.object({
  query_text: z.string().min(10).max(500),
  category: z.enum(queryCategories),
  audience: z.string().min(1).max(120),
  intent: z.string().min(1).max(200),
}).strict();
export const generatedQuerySchema = benchmarkQuerySchema.extend({
  location: z.string().trim().max(160).nullable(),
  evaluation_dimensions: dimensionsSchema,
  truth_suggestions: z.array(truthSuggestionSchema).max(12),
}).strict();
export const benchmarkBatchSchema = z.object({
  queries: z.array(generatedQuerySchema).min(10).max(15),
}).strict();
export const manualQuerySchema = benchmarkQuerySchema.extend({
  location: z.string().trim().max(160).nullable(),
  is_active: z.boolean(),
}).strict();
export type BenchmarkQuery = z.infer<typeof benchmarkQuerySchema>;
export type QueryResult = {
  id: string;
  query_id: string;
  ai_platform: string;
  tested_at: string;
  mentioned: boolean;
  recommendation_position: number | null;
  response_text: string | null;
  response_reference: string | null;
  claims_checked: number;
  verified_claims: number;
  accuracy_percentage: number | null;
  conflict_count: number;
};
export type SavedQuery = BenchmarkQuery & {
  id: string;
  created_at: string;
  updated_at: string;
  location: string | null;
  is_active: boolean;
  origin?: "generated" | "manual" | null;
  batch_id?: string | null;
  batch?: GenerationBatch | null;
  evaluation_dimensions?: EvaluationDimension[];
  truth_links?: TruthFact[];
  analysis?: QueryAnalysis | null;
  results: QueryResult[];
};

export function validateBenchmarkBatch(value: unknown) {
  const batch = benchmarkBatchSchema.parse(value);
  const normalized = batch.queries.map(q => ({
    ...q, query_text: q.query_text.trim(), audience: q.audience.trim(), intent: q.intent.trim(),
  }));
  benchmarkBatchSchema.parse({ queries: normalized });
  if (new Set(normalized.map(q => q.query_text.toLowerCase())).size !== normalized.length) {
    throw new Error("The generated batch contains duplicate queries. Nothing was saved.");
  }
  return normalized;
}
