"use client";

import { useState, useTransition } from "react";
import { runMonitoringScan } from "@/app/monitoring/actions";
import { Icon } from "@/components/icons";
import { MetricCard, MiniStat, SectionCard } from "@/components/ui";
import type { MonitoringDashboardData } from "@/lib/monitoring/data";
import type { MonitoringRun, ResponseClaim, VerificationStatus } from "@/lib/monitoring/schema";

function metric(value: number | null, suffix = "%") {
  return value === null ? "—" : `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function date(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function RunStatus({ run }: { run: MonitoringRun }) {
  const styles = { completed: "bg-green-50 text-green-700", failed: "bg-red-50 text-red-700", running: "bg-blue-50 text-blue-700", pending: "bg-slate-100 text-slate-600" };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[run.status]}`}>{run.status}</span>;
}

function ClaimBadge({ status }: { status: VerificationStatus }) {
  const styles = { verified: "bg-green-50 text-green-700", conflict: "bg-amber-50 text-amber-700", needs_review: "bg-slate-100 text-slate-600" };
  return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${styles[status]}`}>{status.replace("_", " ")}</span>;
}

export function MonitoringDashboard({ data }: { data: MonitoringDashboardData }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function scan() {
    setMessage(""); setError("");
    startTransition(async () => {
      const result = await runMonitoringScan();
      setError(result.error ?? "");
      setMessage(result.message ?? "");
      setConfirming(false);
    });
  }

  const run = data.latestRun;
  const metrics = data.metrics;
  return <main className="space-y-5 border-t border-slate-200 bg-[#f8fafc] p-5 lg:p-7">
    {(run || data.metricRun) && <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold text-slate-950">Controlled prototype scan</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Tests up to five active benchmark queries. Every raw answer and deterministic fact comparison is preserved before FAIR calculates metrics.</p></div><button type="button" onClick={() => setConfirming(true)} disabled={pending || !!data.setup || run?.status === "running" || run?.status === "pending"} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Icon name="play"/>{pending ? "Scan running…" : "Run AI Scan"}</button></div>}

    {confirming && <div role="dialog" aria-label="Confirm prototype scan" className="rounded-xl border border-blue-200 bg-blue-50 p-5"><h3 className="font-semibold text-slate-950">Run a controlled AI scan?</h3><p className="mt-2 text-sm leading-6 text-slate-600">This prototype scan will test up to 5 active benchmark queries. It will make up to 5 OpenAI requests: one monitored answer per query. FAIR evaluates those saved answers with backend code. Nothing runs automatically.</p><div className="mt-4 flex gap-2"><button type="button" onClick={scan} disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Running…" : "Run up to 5 queries"}</button><button type="button" onClick={() => setConfirming(false)} disabled={pending} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button></div></div>}
    {data.setup && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{data.setup}</p>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</p>}

    {!run && !data.metricRun ? <SectionCard><div className="p-10 text-center"><span className="mx-auto grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon name="pulse"/></span><h2 className="mt-4 text-base font-semibold text-slate-950">No benchmark results yet</h2><p className="mt-2 text-sm text-slate-500">Run your first AI scan to measure:</p><ul className="mx-auto mt-3 w-fit space-y-1 text-left text-sm text-slate-600"><li>• Visibility</li><li>• Recommendation performance</li><li>• Factual accuracy</li></ul><button type="button" onClick={() => setConfirming(true)} disabled={pending || !!data.setup} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Icon name="play"/>Run AI Scan</button></div></SectionCard> : <>
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <SectionCard title="Latest monitoring run" description={run ? `${date(run.started_at)} · ${run.provider} · ${run.model}` : "No real monitoring run has been completed yet"} action={run ? <RunStatus run={run}/> : undefined}>
        <div className="p-5">{run ? <><div className="grid gap-2 sm:grid-cols-2">{["Raw AI answers saved", "Evidence parsed by backend", "Linked truth compared", "Metrics calculated in backend code"].map((step, index) => <div key={step} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs font-medium text-slate-700"><span className={`grid size-5 place-items-center rounded-full ${run.status === "completed" ? "bg-green-100 text-green-700" : index === 0 && data.results.length ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"}`}><Icon name={run.status === "completed" ? "check" : "clock"} className="size-3"/></span>{step}</div>)}</div>{run.error_message && <p className="mt-4 text-sm text-red-700">{run.error_message}</p>}</> : <p className="text-sm leading-6 text-slate-500">Apply the monitoring migration, then manually run the first controlled scan. FAIR will not display fabricated results.</p>}</div>
      </SectionCard>
      <SectionCard title="Run summary" description={run ? `Evidence saved from ${data.results.length} completed query results` : "Waiting for real evidence"}><div className="grid grid-cols-2 gap-y-6 p-5"><MiniStat label="Queries selected" value={run ? String(run.query_count) : "—"}/><MiniStat label="Results saved" value={run ? String(data.results.length) : "—"}/><MiniStat label="Business mentioned" value={run ? String(data.results.filter(result => result.mentioned).length) : "—"} tone="blue"/><MiniStat label="Fact comparisons" value={run ? String(data.results.reduce((sum, result) => sum + result.claims.length, 0)) : "—"}/><MiniStat label="Conflicts" value={run ? String(data.results.reduce((sum, result) => sum + result.conflict_count, 0)) : "—"} tone="amber"/><MiniStat label="Needs review" value={run ? String(data.results.flatMap(result => result.claims).filter(claim => claim.verification_status === "needs_review").length) : "—"}/></div></SectionCard>
    </div>

    <section><div className="mb-3"><h2 className="font-semibold text-slate-950">Deterministic FAIR metrics</h2><p className="mt-1 text-xs text-slate-500">Calculated from the latest completed run and the current active benchmark set. “—” means there is not enough qualifying evidence.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Mention Rate" value={metric(metrics.mentionRate)} icon="pulse">Mentioned results / tested results</MetricCard><MetricCard label="Recommendation Rate" value={metric(metrics.recommendationRate)} icon="check">Recommended results / tested results</MetricCard><MetricCard label="Top Recommendation Rate" value={metric(metrics.topRecommendationRate)} icon="grid">Position-one recommendations / tested results</MetricCard><MetricCard label="Average Position" value={metric(metrics.averagePosition, "")} icon="search">Only results with a meaningful position</MetricCard><MetricCard label="Fact Accuracy" value={metric(metrics.factAccuracy)} icon="shield">{metrics.verifiedClaims} verified / {metrics.claimsChecked} comparable claims</MetricCard><MetricCard label="Conflict Rate" value={metric(metrics.conflictRate)} icon="alert">{metrics.conflicts} conflicts / {metrics.claimsChecked} comparable claims</MetricCard><MetricCard label="Test Coverage" value={metric(metrics.testCoverage)} icon="platform">{metrics.testedQueries} of {metrics.activeQueries} active queries tested</MetricCard><MetricCard label="Offering Coverage" value={metric(metrics.offeringCoverage.percentage)} icon="box">{metrics.offeringCoverage.tested} of {metrics.offeringCoverage.benchmarked} linked offerings tested</MetricCard></div></section>

    <div className="grid gap-5 xl:grid-cols-2"><VisibilityBreakdown title="Category Visibility" rows={metrics.categoryVisibility}/><VisibilityBreakdown title="Audience Visibility" rows={metrics.audienceVisibility}/></div>

    <SectionCard title="Latest response evidence" description="Raw answers, backend-parsed evidence, and deterministic truth comparisons from the latest run">
      {data.results.length ? <div className="divide-y divide-slate-200">{data.results.map(result => <article key={result.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{result.query_text}</h3><p className="mt-1 text-xs text-slate-500">{result.category} · {result.provider} · {date(result.tested_at)}</p></div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${result.mentioned ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{result.mentioned ? "Mentioned" : "Not mentioned"}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${result.recommended ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{result.recommended ? "Recommended" : "Not recommended"}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Position {result.recommendation_position ?? "—"}</span></div></div><details className="mt-4"><summary className="cursor-pointer text-xs font-semibold text-blue-700">Raw AI response preview</summary><p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">{result.raw_response_text}</p></details><div className="mt-4"><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fact comparisons</h4>{result.claims.length ? <div className="mt-2 space-y-2">{result.claims.map(claim => <ClaimEvidence key={claim.id} claim={claim}/>)}</div> : <p className="mt-2 text-sm text-slate-500">No linked facts were evaluated for this response.</p>}</div></article>)}</div> : <div className="p-8 text-center"><span className="mx-auto grid size-10 place-items-center rounded-lg bg-blue-50 text-blue-600"><Icon name="search"/></span><p className="mt-3 font-semibold text-slate-900">No real response evidence yet</p><p className="mt-2 text-sm text-slate-500">Run the controlled scan manually when the database migration and API key are ready.</p></div>}
    </SectionCard></>}
  </main>;
}

function VisibilityBreakdown({ title, rows }: { title: string; rows: { label: string; tested: number; mentioned: number; mentionRate: number }[] }) {
  return <SectionCard title={title} description="Mention rate within FAIR's controlled benchmark"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Segment</th><th>Tested</th><th>Mentioned</th><th>Rate</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.label}><td className="font-semibold text-slate-800">{row.label}</td><td>{row.tested}</td><td>{row.mentioned}</td><td>{metric(row.mentionRate)}</td></tr>) : <tr><td colSpan={4} className="py-8 text-center text-slate-500">Not enough data</td></tr>}</tbody></table></div></SectionCard>;
}

function ClaimEvidence({ claim }: { claim: ResponseClaim }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-800">{claim.offering ? `${claim.offering} · ` : ""}{claim.fact_key?.replaceAll("_", " ") ?? claim.subject}</p><ClaimBadge status={claim.verification_status}/></div><div className="mt-2 grid gap-2 text-xs sm:grid-cols-2"><p><span className="font-semibold text-slate-500">Observed:</span> {claim.observed_value}</p><p><span className="font-semibold text-slate-500">Verified snapshot:</span> {claim.canonical_value_snapshot ?? "No comparable linked fact"}</p></div><p className="mt-2 text-xs text-slate-500">Evidence: “{claim.evidence_text}”</p></div>;
}
