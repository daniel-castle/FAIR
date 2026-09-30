import { z } from "zod";

const optionalText = z.string().min(1).max(300).nullable();
export const queryAnalysisSchema = z.object({
  category: optionalText,
  intent: optionalText,
  audience: optionalText,
  location: optionalText,
  target_business: optionalText,
  target_offering: optionalText,
  target_category: optionalText,
  price_constraint: optionalText,
  time_constraint: optionalText,
  requested_attributes: z.array(z.string().min(1).max(150)).max(15),
  expected_fact_types: z.array(z.enum([
    "price", "hours", "availability", "location", "service_area", "warranty",
    "features", "compatibility", "policies", "certifications",
  ])).max(10),
  comparison_target: optionalText,
}).strict();
export type QueryAnalysis = z.infer<typeof queryAnalysisSchema>;
