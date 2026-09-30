/* eslint-disable @typescript-eslint/no-require-imports -- Offline CommonJS test harness; no database or OpenAI calls. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

for (const ext of [".ts", ".tsx"]) require.extensions[ext] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText, filename);

const { businessMentioned, identityAliases } = require("../src/lib/monitoring/identity.ts");
const { compareFactValues } = require("../src/lib/monitoring/verify.ts");
const { evaluateMonitoredResponse } = require("../src/lib/monitoring/evaluate.ts");
const { calculateMonitoringMetrics } = require("../src/lib/metrics/monitoring.ts");

const aliases = identityAliases("Surf & Turf Tacos", ["S&T Tacos"]);
assert.equal(businessMentioned("Try Surf & Turf Tacos in Ceres.", [], aliases), true);
assert.equal(businessMentioned("Try a different restaurant.", ["Other Place"], aliases), false);
assert.equal(businessMentioned("Try these tacos.", ["Tacos"], aliases), false);

assert.equal(compareFactValues("$14.78", "$14.78 USD"), "verified");
assert.equal(compareFactValues("$12.00", "$14.78 USD"), "conflict");
assert.equal(compareFactValues("11 PM", "11:00 PM"), "verified");
assert.equal(compareFactValues("9 PM", "11:00 PM"), "conflict");
assert.equal(compareFactValues("Yes", "true"), "verified");
assert.equal(compareFactValues("A long explanation that is not a simple scalar and cannot be confidently compared without interpretation.".repeat(2), "Different complex value".repeat(10)), "needs_review");

const evaluated = evaluateMonitoredResponse({
  rawResponse: "Top options:\n1. Other Tacos — downtown.\n2. Surf & Turf Tacos — the Signature Taco costs $14.78.",
  businessName: "Surf & Turf Tacos",
  aliases,
  linkedFacts: [{ id: "fact-1", key: "price", offering: "Signature Taco", value: "$14.78 USD", verified: true }],
  evaluateFacts: true,
});
assert.equal(evaluated.mentioned, true);
assert.equal(evaluated.recommended, true);
assert.equal(evaluated.recommendation_position, 2);
assert.equal(evaluated.claims[0].verification_status, "verified");
assert.equal(evaluated.claims[0].value, "$14.78");
const bullet = evaluateMonitoredResponse({ rawResponse: "Good options:\n- Surf & Turf Tacos\n- Other Tacos", businessName: "Surf & Turf Tacos", aliases, linkedFacts: [], evaluateFacts: false });
assert.equal(bullet.recommended, true);
assert.equal(bullet.recommendation_position, null);
const mentionOnly = evaluateMonitoredResponse({ rawResponse: "Surf & Turf Tacos is located in Ceres.", businessName: "Surf & Turf Tacos", aliases, linkedFacts: [], evaluateFacts: false });
assert.equal(mentionOnly.mentioned, true);
assert.equal(mentionOnly.recommended, false);
assert.deepEqual(mentionOnly.claims, []);
const conflictingTime = evaluateMonitoredResponse({ rawResponse: "Surf & Turf Tacos closes at 9 PM.", businessName: "Surf & Turf Tacos", aliases, linkedFacts: [{ id: "fact-2", key: "closing_time", offering: null, value: "11:00 PM", verified: true }], evaluateFacts: true });
assert.equal(conflictingTime.claims[0].verification_status, "conflict");
const ambiguous = evaluateMonitoredResponse({ rawResponse: "Surf & Turf Tacos has convenient hours.", businessName: "Surf & Turf Tacos", aliases, linkedFacts: [{ id: "fact-2", key: "closing_time", offering: null, value: "11:00 PM", verified: true }], evaluateFacts: true });
assert.equal(ambiguous.claims[0].verification_status, "needs_review");
const multiplePrices = evaluateMonitoredResponse({ rawResponse: "At Surf & Turf Tacos, the Signature Taco may be $12.00 or $15.00 depending on the option.", businessName: "Surf & Turf Tacos", aliases, linkedFacts: [{ id: "fact-1", key: "price", offering: "Signature Taco", value: "$14.78 USD", verified: true }], evaluateFacts: true });
assert.equal(multiplePrices.claims[0].verification_status, "needs_review");

const queries = [
  { id: "q1", category: "Discovery", audience: "Local", is_active: true },
  { id: "q2", category: "Discovery", audience: "Budget", is_active: true },
  { id: "q3", category: "Factual", audience: "Local", is_active: false },
];
const results = [
  { query_id: "q1", mentioned: true, recommended: true, recommendation_position: 1, claims_checked: 3, verified_claims: 2, conflict_count: 1 },
  { query_id: "q2", mentioned: false, recommended: false, recommendation_position: null, claims_checked: 1, verified_claims: 1, conflict_count: 0 },
  { query_id: "q3", mentioned: true, recommended: true, recommendation_position: 1, claims_checked: 100, verified_claims: 0, conflict_count: 100 },
];
const metrics = calculateMonitoringMetrics(queries, results, { q1: ["offering-1"], q2: ["offering-2"], q3: ["offering-3"] });
assert.equal(metrics.mentionRate, 50);
assert.equal(metrics.recommendationRate, 50);
assert.equal(metrics.topRecommendationRate, 50);
assert.equal(metrics.averagePosition, 1);
assert.equal(metrics.factAccuracy, 75); // Aggregate 3 verified / 4 checked, never average per-query percentages.
assert.equal(metrics.conflictRate, 25);
assert.equal(metrics.testCoverage, 100);
assert.deepEqual(metrics.offeringCoverage, { benchmarked: 2, tested: 2, percentage: 100 });
assert.equal(metrics.categoryVisibility[0].mentionRate, 50);
assert.equal(calculateMonitoringMetrics(queries, []).factAccuracy, null);

const openAiSource = fs.readFileSync(path.join(__dirname, "../src/lib/monitoring/openai.ts"), "utf8");
assert(openAiSource.includes('MONITORING_MODEL = "gpt-5.6-luna"'));
assert(openAiSource.includes("maxRetries: 0"));
assert(openAiSource.includes("MAX_QUERIES_PER_RUN = 15"));
assert(!openAiSource.includes("mention_rate"));
assert(!openAiSource.includes("responses.parse"));
assert(!openAiSource.includes("extractResponseEvidence"));

const actionsSource = fs.readFileSync(path.join(__dirname, "../src/app/monitoring/actions.ts"), "utf8");
const runnerSource = fs.readFileSync(path.join(__dirname, "../src/components/benchmark-runner.tsx"), "utf8");
assert.equal((actionsSource.match(/await requestMonitoredAnswer\(query\.query_text\)/g) ?? []).length, 2);
assert(actionsSource.includes("queries: z.array(localQuerySchema).min(1).max(MAX_QUERIES_PER_RUN)"));
assert(runnerSource.includes("selected.slice(0, 15)"));
assert(runnerSource.includes("Run up to 15 active questions?"));
assert(runnerSource.includes("Benchmark complete ·"));
assert(runnerSource.includes("fixed bottom-5 right-5"));
assert(runnerSource.includes("disabled={pending || !hasActiveQueries}"));
assert(!runnerSource.includes("Activate at least one benchmark query"));

console.log("Passed: deterministic evidence and metrics, 15-query cap, one request per selected query, gpt-5.6-luna/no-retry safeguards, and stable benchmark completion UI.");
