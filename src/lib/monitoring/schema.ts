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

export type HumanReviewDecision = VerificationStatus;

export type HumanReview = {
  id: string;
  claim_id: string;
  original_machine_status: VerificationStatus;
  human_status: HumanReviewDecision;
  reviewer_note: string;
  resolved: boolean;
  reviewed_at: string;
  resolved_at: string | null;
};

export type SpecialistRecommendation = {
  id: string;
  title: string;
  rationale: string;
  linked_evidence: string;
  priority: "low" | "medium" | "high";
  status: "proposed" | "in_progress" | "completed";
  specialist_note: string;
  recommended_next_action?: string;
  created_at: string;
  updated_at: string;
};

export type SpecialistReviewRequest = {
  id: string;
  status: "requested";
  requested_at: string;
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
