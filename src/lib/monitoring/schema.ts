export type VerificationStatus = "verified" | "conflict" | "needs_review";

export type MonitoringRun = {
  id: string;
  business_id: string;
  status: "pending" | "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  query_count: number;
  provider: string;
  model: string;
  error_message: string | null;
};

export type ResponseClaim = {
  id: string;
  result_id: string;
  fact_id: string | null;
  subject: string;
  offering: string | null;
  fact_key: string | null;
  observed_value: string;
  canonical_value_snapshot: string | null;
  verification_status: VerificationStatus;
  evidence_text: string;
  created_at: string;
};

export type MonitoringResult = {
  id: string;
  monitoring_run_id: string;
  query_id: string;
  business_id: string;
  provider: string;
  model: string;
  tested_at: string;
  raw_response_text: string;
  mentioned: boolean;
  recommended: boolean;
  recommendation_position: number | null;
  mentioned_businesses: string[];
  claims_checked: number;
  verified_claims: number;
  conflict_count: number;
  query_text: string;
  category: string;
  audience: string;
  claims: ResponseClaim[];
};
