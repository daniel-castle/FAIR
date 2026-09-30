"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { MetricCard, MiniStat, SectionCard } from "@/components/ui";
import type { MonitoringRun, ResponseClaim, VerificationStatus } from "@/lib/monitoring/schema";
import type { SavedQuery } from "@/lib/queries/schema";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { buildWorkspaceMonitoringData } from "@/lib/workspace/monitoring";
import { showsPosition, showsRecommendation } from "@/lib/queries/presentation";

function metric(value: number | null, suffix = "%") {
  return value === null ? "—" : `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function date(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function comparableContext(count: number) {
  return count > 0 && count <= 2 ? ` · Based on ${count} comparable ${count === 1 ? "claim" : "claims"}` : "";
}

function factDetail(value: number, count: number, outcome: "verified" | "conflicted") {
  return count ? `${value} of ${count} comparable claims ${outcome}${comparableContext(count)}` : "No comparable claims";
}

function RunStatus({ run }: { run: MonitoringRun }) {
  const styles = { completed: "bg-green-50 text-green-700", failed: "bg-red-50 text-red-700", running: "bg-blue-50 text-blue-700", pending: "bg-slate-100 text-slate-600" };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[run.status]}`}>{run.status}</span>;
}

function ClaimBadge({ status }: { status: VerificationStatus }) {
  const styles = { verified: "bg-green-50 text-green-700", conflict: "bg-amber-50 text-amber-700", needs_review: "bg-slate-100 text-slate-600" };
  return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${styles[status]}`}>{status.replace("_", " ")}</span>;
}

export function MonitoringDashboard() {
  const { workspace } = useWorkspace();
  const queries = workspace!.queries.items as unknown as SavedQuery[];
  const queryById = new Map(queries.map(query => [query.id, query]));
  const data = buildWorkspaceMonitoringData(workspace!);

  const run = data.latestRun;
  const metrics = data.metrics;
  return <main className="space-y-5 border-t border-slate-200 bg-[#f8fafc] p-5 lg:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold text-slate-950">Benchmark analysis</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Read-only analysis of the latest browser-local benchmark evidence.</p></div><Link href="/queries" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">Manage / Run benchmark <Icon name="arrow"/></Link></div>

    {!run && !data.metricRun ? <SectionCard><div className="p-10 text-center"><span className="mx-auto grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon name="pulse"/></span><h2 className="mt-4 text-base font-semibold text-slate-950">No benchmark results yet</h2><p className="mt-2 text-sm text-slate-500">Run your first benchmark from Queries to measure visibility, recommendation performance, and factual accuracy.</p></div></SectionCard> : <>
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <SectionCard title="Latest monitoring run" description={run ? `${date(run.started_at)} · ${run.provider} · ${run.model}` : "No real monitoring run has been completed yet"} action={run ? <RunStatus run={run}/> : undefined}>
        <div className="p-5">{run ? <><div className="grid gap-2 sm:grid-cols-2">{["Raw AI answers saved", "Evidence parsed by backend", "Linked truth compared", "Metrics calculated in backend code"].map((step, index) => <div key={step} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs font-medium text-slate-700"><span className={`grid size-5 place-items-center rounded-full ${run.status === "completed" ? "bg-green-100 text-green-700" : index === 0 && data.results.length ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"}`}><Icon name={run.status === "completed" ? "check" : "clock"} className="size-3"/></span>{step}</div>)}</div>{run.error_message && <p className="mt-4 text-sm text-red-700">{run.error_message}</p>}</> : <p className="text-sm leading-6 text-slate-500">Manually run the first controlled scan when your active benchmark queries are ready.</p>}</div>
      </SectionCard>
      <SectionCard title="Run summary" description={run ? `Evidence saved from ${data.results.length} completed query results` : "Waiting for real evidence"}><div className="grid grid-cols-2 gap-y-6 p-5"><MiniStat label="Queries selected" value={run ? String(run.query_count) : "—"}/><MiniStat label="Results saved" value={run ? String(data.results.length) : "—"}/><MiniStat label="Business mentioned" value={run ? String(data.results.filter(result => result.mentioned).length) : "—"} tone="blue"/><MiniStat label="Fact comparisons" value={run ? String(data.results.reduce((sum, result) => sum + result.claims.length, 0)) : "—"}/><MiniStat label="Conflicts" value={run ? String(data.results.reduce((sum, result) => sum + result.conflict_count, 0)) : "—"} tone="amber"/><MiniStat label="Needs review" value={run ? String(data.results.flatMap(result => result.claims).filter(claim => claim.verification_status === "needs_review").length) : "—"}/></div></SectionCard>
    </div>

    <section><div className="mb-3"><h2 className="font-semibold text-slate-950">Deterministic FAIR metrics</h2><p className="mt-1 text-xs text-slate-500">Calculated from the latest completed run and the current active benchmark set. “—” means there is not enough qualifying evidence.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Mention Rate" value={metric(metrics.mentionRate)} icon="pulse">Mentioned results / tested results</MetricCard><MetricCard label="Recommendation Rate" value={metric(metrics.recommendationRate)} icon="check">Recommended results / tested results</MetricCard><MetricCard label="Top Recommendation Rate" value={metric(metrics.topRecommendationRate)} icon="grid">Position-one recommendations / tested results</MetricCard><MetricCard label="Average Position" value={metric(metrics.averagePosition, "")} icon="search">Only results with a meaningful position</MetricCard><MetricCard label="Fact Accuracy" value={metric(metrics.factAccuracy)} icon="shield">{factDetail(metrics.verifiedClaims, metrics.claimsChecked, "verified")}</MetricCard><MetricCard label="Conflict Rate" value={metric(metrics.conflictRate)} icon="alert">{factDetail(metrics.conflicts, metrics.claimsChecked, "conflicted")}</MetricCard><MetricCard label="Test Coverage" value={metric(metrics.testCoverage)} icon="platform">{metrics.testedQueries} of {metrics.activeQueries} active queries tested</MetricCard><MetricCard label="Offering Coverage" value={metric(metrics.offeringCoverage.percentage)} icon="box">{metrics.offeringCoverage.tested} of {metrics.offeringCoverage.benchmarked} linked offerings tested</MetricCard></div></section>

    <div className="grid gap-5 xl:grid-cols-2"><VisibilityBreakdown title="Category Visibility" rows={metrics.categoryVisibility}/><VisibilityBreakdown title="Audience Visibility" rows={metrics.audienceVisibility}/></div>

    <SectionCard title="Latest response evidence" description="Raw answers, backend-parsed evidence, and deterministic truth comparisons from the latest run">
      {data.results.length ? <div className="divide-y divide-slate-200">{data.results.map(result => { const query = queryById.get(result.query_id); return <article key={result.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{result.query_text}</h3><p className="mt-1 text-xs text-slate-500">{result.category} · {result.provider} · {date(result.tested_at)}</p></div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${result.mentioned ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{result.mentioned ? "Mentioned" : "Not mentioned"}</span>{query && showsRecommendation(query) && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${result.recommended ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{result.recommended ? "Recommended" : "Not recommended"}</span>}{query && showsPosition(query) && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Position {result.recommendation_position ?? "—"}</span>}</div></div><details className="mt-4"><summary className="cursor-pointer text-xs font-semibold text-blue-700">Raw AI response preview</summary><p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">{result.raw_response_text}</p></details><div className="mt-4"><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fact comparisons</h4>{result.claims.length ? <div className="mt-2 space-y-2">{result.claims.map(claim => <ClaimEvidence key={claim.id} claim={claim}/>)}</div> : <p className="mt-2 text-sm text-slate-500">No linked facts were evaluated for this response.</p>}</div></article>; })}</div> : <div className="p-8 text-center"><span className="mx-auto grid size-10 place-items-center rounded-lg bg-blue-50 text-blue-600"><Icon name="search"/></span><p className="mt-3 font-semibold text-slate-900">No real response evidence yet</p><p className="mt-2 text-sm text-slate-500">Run the benchmark from Queries when your active benchmark queries are ready.</p></div>}
    </SectionCard></>}
  </main>;
}

function VisibilityBreakdown({ title, rows }: { title: string; rows: { label: string; tested: number; mentioned: number; mentionRate: number }[] }) {
  return <SectionCard title={title} description="Mention rate within FAIR's controlled benchmark"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Segment</th><th>Tested</th><th>Mentioned</th><th>Rate</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.label}><td className="font-semibold text-slate-800">{row.label}</td><td>{row.tested}</td><td>{row.mentioned}</td><td>{metric(row.mentionRate)}</td></tr>) : <tr><td colSpan={4} className="py-8 text-center text-slate-500">Not enough data</td></tr>}</tbody></table></div></SectionCard>;
}

function ClaimEvidence({ claim }: { claim: ResponseClaim }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-800">{claim.offering ? `${claim.offering} · ` : ""}{claim.fact_key?.replaceAll("_", " ") ?? claim.subject}</p><ClaimBadge status={claim.verification_status}/></div><div className="mt-2 grid gap-2 text-xs sm:grid-cols-2"><p><span className="font-semibold text-slate-500">Observed:</span> {claim.observed_value}</p><p><span className="font-semibold text-slate-500">Verified snapshot:</span> {claim.canonical_value_snapshot ?? "No comparable linked fact"}</p></div><p className="mt-2 text-xs text-slate-500">Evidence: “{claim.evidence_text}”</p></div>;
}
