import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { MetricCard, MiniStat, ProgressBar, SectionCard } from "@/components/ui";
import { Icon } from "@/components/icons";
import { loadMonitoringDashboard } from "@/lib/monitoring/data";

export const dynamic = "force-dynamic";

function metric(value: number | null, suffix = "%") {
  return value === null ? "—" : `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

export default async function OverviewPage() {
  const data = await loadMonitoringDashboard();
  const metrics = data.metrics;
  return <><PageHeader title="Overview" description="Your AI presence, truth accuracy, and current benchmark evidence." action={<Link href="/metrics" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-3.5 text-sm font-semibold text-white hover:bg-blue-700"><Icon name="play"/>Open Metrics</Link>}/><main className="space-y-5 border-t border-slate-200 bg-[#f8fafc] p-5 lg:p-7">
    {data.setup && <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{data.setup}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Mention Rate" value={metric(metrics.mentionRate)} icon="pulse"><span className="font-semibold text-slate-700">{metrics.testedQueries} tested</span> · {metrics.activeQueries} active benchmarks</MetricCard><MetricCard label="Recommendation Rate" value={metric(metrics.recommendationRate)} icon="check"><span className="font-semibold text-slate-700">{metric(metrics.topRecommendationRate)}</span> top recommendation rate</MetricCard><MetricCard label="Fact Accuracy" value={metric(metrics.factAccuracy)} icon="shield"><span className="font-semibold text-slate-700">{metrics.claimsChecked} comparable claims</span> · {metrics.verifiedClaims} verified</MetricCard><MetricCard label="Test Coverage" value={metric(metrics.testCoverage)} icon="platform"><span className="font-semibold text-slate-700">{metrics.testedQueries} of {metrics.activeQueries}</span> active queries tested</MetricCard></div>

    <div className="grid gap-5 xl:grid-cols-[1fr_2fr]">
      <SectionCard title="Evidence summary" description="Deterministic values from the latest completed monitoring run"><div className="grid grid-cols-2 gap-y-6 p-5"><MiniStat label="Average position" value={metric(metrics.averagePosition, "")}/><MiniStat label="Conflict rate" value={metric(metrics.conflictRate)} tone={metrics.conflicts ? "amber" : "default"}/><MiniStat label="Verified claims" value={String(metrics.verifiedClaims)} tone="green"/><MiniStat label="Conflicts" value={String(metrics.conflicts)} tone={metrics.conflicts ? "amber" : "default"}/><MiniStat label="Linked offerings tested" value={`${metrics.offeringCoverage.tested}/${metrics.offeringCoverage.benchmarked}`} tone="blue"/><MiniStat label="Latest completed run" value={data.metricRun ? "Available" : "No data"}/></div></SectionCard>
      <SectionCard title="Category visibility" description="Mention rate within FAIR's controlled benchmark, grouped by query category"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Query category</th><th>Tested</th><th>Mentioned</th><th>Mention rate</th></tr></thead><tbody>{metrics.categoryVisibility.length ? metrics.categoryVisibility.map(row => <tr key={row.label}><td><span className="inline-flex items-center gap-2 font-semibold text-slate-800"><Icon name="chevron" className="size-3 text-slate-400"/>{row.label}</span></td><td>{row.tested}</td><td>{row.mentioned}</td><td><div className="flex min-w-28 items-center gap-2"><ProgressBar value={row.mentionRate}/><span className="w-10 text-xs font-semibold">{metric(row.mentionRate)}</span></div></td></tr>) : <tr><td colSpan={4} className="py-10 text-center text-slate-500">Not enough real monitoring data yet.</td></tr>}</tbody></table></div></SectionCard>
    </div>

    <SectionCard title="How FAIR calculates these metrics" description="Raw answers remain inspectable; core scores are never supplied by AI"><div className="grid gap-3 p-5 md:grid-cols-4">{["Monitored AI answer is stored", "Backend parses measurable evidence", "Backend compares verified truth", "Backend calculates metrics"].map((step, index) => <div key={step} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><span className="grid size-7 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white">{index + 1}</span><p className="mt-3 text-sm font-semibold text-slate-800">{step}</p></div>)}</div></SectionCard>
  </main></>;
}
