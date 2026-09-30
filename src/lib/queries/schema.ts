import { z } from "zod";
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
export const benchmarkBatchSchema = z.object({
  queries: z.array(benchmarkQuerySchema).min(10).max(15),
}).strict();
export type BenchmarkQuery = z.infer<typeof benchmarkQuerySchema>;
export type SavedQuery = BenchmarkQuery & { id: string; created_at: string; analysis?: QueryAnalysis | null };

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
