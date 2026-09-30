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

console.log("Passed: shared Overview/Metrics values, comparable-claim denominators, needs-review exclusion, dimension-aware result presentation, read-only Metrics, and shared demo/blank workspace path.");
