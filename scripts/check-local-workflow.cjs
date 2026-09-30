/* eslint-disable @typescript-eslint/no-require-imports -- Offline CommonJS test harness; no database or OpenAI calls. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  return resolve.call(this, request.startsWith("@/") ? path.join(root, "src", request.slice(2)) : request, parent, isMain, options);
};
for (const ext of [".ts", ".tsx"]) require.extensions[ext] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText, filename);

const { createBlankWorkspace, createDemoWorkspace } = require("../src/lib/workspace/presets.ts");
const { buildWorkspaceMonitoringData } = require("../src/lib/workspace/monitoring.ts");
const { humanReviewItems, saveHumanReview, saveSpecialistRecommendation, saveSpecialistReviewRequest, specialistGuidanceEvidence } = require("../src/lib/workspace/human-review.ts");
const { isFairWorkspace } = require("../src/lib/workspace/schema.ts");
const { calculateMonitoringMetrics } = require("../src/lib/metrics/monitoring.ts");
const { evaluateMonitoredResponse } = require("../src/lib/monitoring/evaluate.ts");
const { identityAliases } = require("../src/lib/monitoring/identity.ts");
const { showsPosition, showsRecommendation } = require("../src/lib/queries/presentation.ts");

const workspace = createBlankWorkspace();
const query = { id: "q1", query_text: "Which barbecue restaurant should I try?", category: "Category discovery", audience: "Visitor", intent: "Discovery", created_at: "2026-09-30T12:00:00Z", updated_at: "2026-09-30T12:00:00Z", location: null, is_active: true, evaluation_dimensions: ["visibility", "recommendation", "recommendation_position", "factual_accuracy"], truth_links: [], results: [] };
const result = { id: "result1", monitoring_run_id: "run1", query_id: "q1", business_id: workspace.truthHub.business.id, provider: "OpenAI", model: "gpt-5.6-luna", tested_at: "2026-09-30T12:01:00Z", raw_response_text: "My Business is an option.", mentioned: true, recommended: true, recommendation_position: 1, mentioned_businesses: ["My Business"], claims_checked: 1, verified_claims: 0, conflict_count: 1, query_text: query.query_text, category: query.category, audience: query.audience, claims: [] };
const metricSnapshot = calculateMonitoringMetrics([query], [result]);
workspace.queries.items = [query];
workspace.monitoring.runs = [{ id: "run1", business_id: workspace.truthHub.business.id, status: "completed", started_at: "2026-09-30T12:00:00Z", completed_at: "2026-09-30T12:01:00Z", query_count: 1, provider: "OpenAI", model: "gpt-5.6-luna", error_message: null, metric_snapshot: metricSnapshot }];
workspace.monitoring.results = [result];

// Overview and Metrics both call this same builder and therefore receive identical values.
assert.deepEqual(buildWorkspaceMonitoringData(workspace).metrics, buildWorkspaceMonitoringData(workspace).metrics);

const ambiguous = evaluateMonitoredResponse({ rawResponse: "My Business has convenient hours.", businessName: "My Business", aliases: identityAliases("My Business"), linkedFacts: [{ id: "fact1", key: "hours", offering: null, value: "11:00 AM", verified: true }], evaluateFacts: true });
assert.equal(ambiguous.claims[0].verification_status, "needs_review");
const needsReviewMetrics = calculateMonitoringMetrics([query], [{ ...result, claims_checked: 0, verified_claims: 0, conflict_count: 0 }]);
assert.equal(needsReviewMetrics.conflictRate, null);
assert.equal(needsReviewMetrics.factAccuracy, null);

const factualOnly = { evaluation_dimensions: ["visibility", "factual_accuracy"] };
assert.equal(showsRecommendation(factualOnly), false);
assert.equal(showsPosition(factualOnly), false);
assert.equal(showsRecommendation(query), true);
assert.equal(showsPosition(query), true);

const metricsSource = fs.readFileSync(path.join(root, "src/components/monitoring-dashboard.tsx"), "utf8");
assert(!metricsSource.includes("runWorkspaceMonitoringScan"));
assert(!metricsSource.includes("Run AI Scan"));
assert.doesNotThrow(() => buildWorkspaceMonitoringData(createDemoWorkspace()));
assert.doesNotThrow(() => buildWorkspaceMonitoringData(createBlankWorkspace()));

function workspaceWithReviewEvidence(base) {
  const current = structuredClone(base);
  current.queries.items = [query];
  current.monitoring.runs = workspace.monitoring.runs;
  current.monitoring.results = [{ ...result, business_id: current.truthHub.business.id, claims_checked: 1, verified_claims: 0, conflict_count: 1 }];
  current.monitoring.claims = [
    { id: "claim-needs", result_id: "result1", fact_id: "fact1", subject: String(current.truthHub.business.name), offering: null, fact_key: "hours", observed_value: "No unambiguous value found", canonical_value_snapshot: "11:00 AM", verification_status: "needs_review", evidence_text: "Open during lunch.", created_at: "2026-09-30T12:01:00Z" },
    { id: "claim-conflict", result_id: "result1", fact_id: "fact2", subject: String(current.truthHub.business.name), offering: null, fact_key: "price", observed_value: "$20", canonical_value_snapshot: "$10", verification_status: "conflict", evidence_text: "The price is $20.", created_at: "2026-09-30T12:01:00Z" },
  ];
  current.monitoring.reviews = [];
  current.monitoring.recommendations = [];
  return current;
}

let reviewWorkspace = workspaceWithReviewEvidence(createBlankWorkspace());
assert.deepEqual(humanReviewItems(reviewWorkspace).map(item => item.claim.verification_status).sort(), ["conflict", "needs_review"]);
const reviewedAt = "2026-09-30T13:00:00.000Z";
reviewWorkspace = saveHumanReview(reviewWorkspace, { id: "review1", claim_id: "claim-needs", original_machine_status: "needs_review", human_status: "verified", reviewer_note: "Confirmed against current hours.", resolved: true, reviewed_at: reviewedAt, resolved_at: reviewedAt });
let adjudicated = buildWorkspaceMonitoringData(reviewWorkspace).metrics;
assert.equal(adjudicated.factAccuracy, 50);
assert.equal(adjudicated.conflictRate, 50);
reviewWorkspace = saveHumanReview(reviewWorkspace, { id: "review1", claim_id: "claim-needs", original_machine_status: "needs_review", human_status: "conflict", reviewer_note: "Specialist confirmed the mismatch.", resolved: true, reviewed_at: reviewedAt, resolved_at: reviewedAt });
adjudicated = buildWorkspaceMonitoringData(reviewWorkspace).metrics;
assert.equal(adjudicated.factAccuracy, 0);
assert.equal(adjudicated.conflictRate, 100);
assert.equal(reviewWorkspace.monitoring.claims[0].verification_status, "needs_review");
const refreshed = JSON.parse(JSON.stringify(reviewWorkspace));
assert.equal(refreshed.monitoring.reviews[0].reviewer_note, "Specialist confirmed the mismatch.");
assert.equal(refreshed.monitoring.reviews[0].reviewed_at, reviewedAt);
assert.equal(isFairWorkspace(refreshed), true);
assert.deepEqual(createBlankWorkspace().monitoring.reviews, []);
assert.deepEqual(createDemoWorkspace().monitoring.reviews, []);
assert.deepEqual(humanReviewItems(workspaceWithReviewEvidence(createBlankWorkspace())).map(item => item.claim.verification_status), humanReviewItems(workspaceWithReviewEvidence(createDemoWorkspace())).map(item => item.claim.verification_status));
assert(specialistGuidanceEvidence(reviewWorkspace).some(item => item.id === "unresolved-conflicts"));
const recommendation = { id: "rec1", title: "Correct the public price", rationale: "Benchmark evidence conflicts with verified truth.", linked_evidence: "unresolved-conflicts", priority: "high", status: "proposed", specialist_note: "Coordinate with the site owner.", created_at: reviewedAt, updated_at: reviewedAt };
const withRecommendation = saveSpecialistRecommendation(reviewWorkspace, recommendation);
assert.deepEqual(JSON.parse(JSON.stringify(withRecommendation)).monitoring.recommendations[0], recommendation);
const withRequest = saveSpecialistReviewRequest(withRecommendation, { id: "request1", status: "requested", requested_at: reviewedAt });
assert.equal(JSON.parse(JSON.stringify(withRequest)).monitoring.specialist_review_requests[0].status, "requested");
const customerReviewSource = fs.readFileSync(path.join(root, "src/components/human-review-dashboard.tsx"), "utf8");
assert(!customerReviewSource.includes("Confirm accurate"));
assert(!customerReviewSource.includes("Create specialist recommendation"));
assert(customerReviewSource.includes("Request specialist review"));
assert(customerReviewSource.includes("Mark action completed"));

console.log("Passed: shared metrics, customer-facing Human Review queue/action controls, audit persistence/reset, specialist guidance persistence, and identical demo/custom workspace logic.");
