"use client";

import { useMemo, useState, useTransition } from "react";
import { generateWorkspaceBenchmarkQueries, type QueryLibrary } from "@/app/queries/actions";
import { batchTime } from "@/components/benchmark-definition";
import { Icon } from "@/components/icons";
import { SectionCard } from "@/components/ui";
import { dimensionLabels, truthFactsForBusiness, type EvaluationDimension } from "@/lib/queries/evaluation";
import { calculateQueryMetrics } from "@/lib/queries/metrics";
import { manualQuerySchema, queryCategories, type QueryResult, type SavedQuery } from "@/lib/queries/schema";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import type { GenerationBatch } from "@/lib/queries/evaluation";
import { BenchmarkRunner } from "@/components/benchmark-runner";
import { showsPosition, showsRecommendation } from "@/lib/queries/presentation";

const emptyForm = { query_text: "", category: queryCategories[0], audience: "", intent: "", location: "", is_active: true };

function automaticDimensions(category: SavedQuery["category"]): EvaluationDimension[] {
  if (category === "Comparison") return ["visibility", "recommendation", "recommendation_position", "competitor_presence"];
  return ["visibility", "recommendation", "recommendation_position"];
}

function date(value?: string) {
  if (!value) return "Not tested";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function readiness(query: SavedQuery) {
  if (!query.is_active) return { label: "Inactive", style: "bg-slate-100 text-slate-600" };
  const dimensions = query.evaluation_dimensions ?? [];
  const links = query.truth_links ?? [];
  if (dimensions.includes("factual_accuracy") && !links.some(fact => fact.verified)) {
    return { label: "Needs Truth Hub link", style: "bg-amber-50 text-amber-700" };
  }
  if (!dimensions.length || links.some(fact => !fact.verified)) {
    return { label: "Needs review", style: "bg-blue-50 text-blue-700" };
  }
  return { label: "Ready for monitoring", style: "bg-green-50 text-green-700" };
}

function SelectFilter({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <select aria-label={label} value={value} onChange={event => onChange(event.target.value)} className="h-9 min-w-36 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"><option value="">All {label.toLowerCase()}</option>{values.map(item => <option key={item} value={item}>{item}</option>)}</select>;
}

export function QueryLibraryView() {
  const { workspace, updateWorkspace } = useWorkspace();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ category: "", audience: "", location: "", status: "", result: "", origin: "" });
  const truthHub = workspace!.truthHub;
  const hub = { ...truthHub, errors: [] };
  const truthFacts = truthFactsForBusiness(hub);
  const library: QueryLibrary = {
    queries: workspace!.queries.items as unknown as SavedQuery[],
    businessName: String(truthHub.business.name || "your business"),
    metrics: calculateQueryMetrics(workspace!.queries.items as unknown as SavedQuery[]),
    batches: workspace!.queries.batches as unknown as GenerationBatch[],
    truthFacts,
  };

  const options = useMemo(() => ({
    categories: [...new Set(library.queries.map(query => query.category))],
    audiences: [...new Set(library.queries.map(query => query.audience))],
    locations: [...new Set(library.queries.map(query => query.location).filter((value): value is string => !!value))],
  }), [library.queries]);

  const activeQueries = library.queries.filter(query => query.is_active);
  const missingTruth = activeQueries.filter(query => (query.evaluation_dimensions ?? []).includes("factual_accuracy") && !(query.truth_links ?? []).some(fact => fact.verified)).length;
  const needsReview = activeQueries.filter(query => !(query.evaluation_dimensions ?? []).length || (query.truth_links ?? []).some(fact => !fact.verified)).length;
  const latestBatch = library.batches[0];

  const queries = library.queries.filter(query => {
    const latest = query.results[0];
    const resultState = !latest ? "not-tested" : latest.mentioned ? "mentioned" : "not-mentioned";
    return (!filters.category || query.category === filters.category)
      && (!filters.audience || query.audience === filters.audience)
      && (!filters.location || query.location === filters.location)
      && (!filters.status || (filters.status === "active") === query.is_active)
      && (!filters.result || filters.result === resultState)
      && (!filters.origin || (filters.origin === "legacy" ? !query.origin : query.origin === filters.origin));
  });

  function run(action: () => Promise<{ error?: string; message?: string }>, onSuccess?: () => void) {
    setError(""); setMessage("");
    startTransition(async () => {
      try {
        const result = await action();
        setError(result.error ?? ""); setMessage(result.message ?? "");
        if (!result.error) onSuccess?.();
      } catch {
        setError("The request was interrupted. Reload to confirm whether the change was saved.");
      }
    });
  }

  async function generateLocalQueries() {
    const result = await generateWorkspaceBenchmarkQueries(truthHub);
    if (result.error || !result.queries) return { error: result.error ?? "Query generation returned no queries." };
    const now = new Date().toISOString();
    const batch = { id: crypto.randomUUID(), created_at: now, query_count: result.queries.length };
    const factsById = new Map(truthFacts.map(fact => [fact.id, fact]));
    const generated: SavedQuery[] = result.queries.map(query => ({
      id: crypto.randomUUID(),
      query_text: query.query_text,
      category: query.category,
      audience: query.audience,
      intent: query.intent,
      location: query.location,
      is_active: true,
      origin: "generated",
      batch_id: batch.id,
      batch,
      created_at: now,
      updated_at: now,
      evaluation_dimensions: query.evaluation_dimensions,
      truth_links: query.fact_ids.flatMap(id => factsById.get(id) ?? []),
      results: [],
    }));
    updateWorkspace(current => ({
      ...current,
      queries: {
        items: [...generated, ...current.queries.items.map(query => query.origin === "generated" ? { ...query, is_active: false, updated_at: now } : query)],
        batches: [batch, ...current.queries.batches],
      },
    }));
    return { message: `${generated.length} generated queries are now active. The previous generated set was archived; manual queries were preserved.` };
  }

  async function createLocalQuery(input: unknown) {
    const parsed = manualQuerySchema.safeParse(input);
    if (!parsed.success) return { error: "Complete the query fields." };
    const duplicate = library.queries.some(query => query.query_text.trim().toLowerCase() === parsed.data.query_text.trim().toLowerCase());
    if (duplicate) return { error: "This exact benchmark query already exists." };
    const now = new Date().toISOString();
    const query: SavedQuery = { ...parsed.data, id: crypto.randomUUID(), origin: "manual", batch_id: null, batch: null, created_at: now, updated_at: now, evaluation_dimensions: automaticDimensions(parsed.data.category), truth_links: [], results: [] };
    updateWorkspace(current => ({ ...current, queries: { ...current.queries, items: [query, ...current.queries.items] } }));
    return { message: "Benchmark question saved with FAIR-configured measurements." };
  }

  async function setLocalActive(queryId: string, isActive: boolean) {
    updateWorkspace(current => ({ ...current, queries: { ...current.queries, items: current.queries.items.map(item => item.id === queryId ? { ...item, is_active: isActive, updated_at: new Date().toISOString() } : item) } }));
    return { message: `Query ${isActive ? "activated" : "paused"}.` };
  }

  const setupMessages = [library.error, library.setup, library.resultsSetup, library.generationSetup, library.definitionSetup, library.truthSetup, error].filter(Boolean);

  return <main className="space-y-5 border-t border-slate-200 bg-[#f8fafc] p-5 lg:p-7">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="font-semibold text-slate-950">Active benchmark set</h2><p className="mt-1 text-sm text-slate-500">Run Benchmark tests these questions against the monitored AI. Refresh Questions rebuilds them from current Truth Hub information.</p></div>
      <div className="flex flex-wrap items-start gap-2"><BenchmarkRunner/><button type="button" onClick={() => run(generateLocalQueries)} disabled={pending} className="rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">{pending ? "Refreshing…" : "Refresh Questions"}</button><button type="button" aria-expanded={showForm} aria-controls="manual-query-form" onClick={() => setShowForm(value => !value)} disabled={pending} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{showForm ? "Close form" : "+ Add Question"}</button></div>
    </div>

    <SectionCard>
      <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-6">
        <SummaryItem label="Active queries" value={String(activeQueries.length)} />
        <SummaryItem label="Categories covered" value={String(new Set(activeQueries.map(query => query.category)).size)} />
        <SummaryItem label="Audiences covered" value={String(new Set(activeQueries.map(query => query.audience)).size)} />
        <SummaryItem label="Need review" value={String(needsReview)} tone={needsReview ? "amber" : "default"} />
        <SummaryItem label="Missing verified truth" value={String(missingTruth)} tone={missingTruth ? "amber" : "default"} />
        <SummaryItem label="Last generated" value={latestBatch ? batchTime(latestBatch.created_at) : "Not generated"} compact />
      </div>
    </SectionCard>

    {showForm && <form id="manual-query-form" className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:grid-cols-2" onSubmit={event => { event.preventDefault(); run(() => createLocalQuery({ ...form, location: form.location.trim() || null }), () => { setForm(emptyForm); setShowForm(false); }); }}>
      <div className="lg:col-span-2"><h3 className="font-semibold text-slate-900">Add a benchmark query</h3><p className="mt-1 text-xs text-slate-500">Use this for an important customer scenario that is not covered by the generated set.</p></div>
      <label className="lg:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Customer question</span><textarea required minLength={10} maxLength={500} value={form.query_text} onChange={event => setForm({ ...form, query_text: event.target.value })} rows={3} placeholder="What would a real customer ask an AI assistant?" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"/></label>
      <FormSelect label="Category" value={form.category} values={[...queryCategories]} onChange={value => setForm({ ...form, category: value as typeof form.category })}/>
      <FormInput label="Audience scenario" value={form.audience} placeholder="e.g. First-time customer" onChange={value => setForm({ ...form, audience: value })}/>
      <FormInput label="Why this matters" value={form.intent} placeholder="e.g. Tests whether customers discover this service" onChange={value => setForm({ ...form, intent: value })}/>
      <FormInput label="Location" value={form.location} placeholder="Optional city or service area" required={false} onChange={value => setForm({ ...form, location: value })}/>
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.is_active} onChange={event => setForm({ ...form, is_active: event.target.checked })} className="size-4 accent-blue-600"/>Active and ready for future monitoring</label>
      <p className="text-xs leading-5 text-slate-500 lg:col-span-2">FAIR automatically configures the measurements for this question based on its category.</p>
      <div className="flex justify-end lg:col-span-2"><button disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{pending ? "Saving…" : "Save benchmark question"}</button></div>
    </form>}

    {setupMessages.length > 0 && <div role="alert" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{setupMessages.map((text, index) => <p key={index}>{text}</p>)}</div>}
    {message && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</p>}

    <SectionCard title="Benchmark Coverage" description={`Customer scenarios for ${library.businessName}. Expand a category to review individual questions.`}>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
        <SelectFilter label="Categories" value={filters.category} values={options.categories} onChange={value => setFilters({ ...filters, category: value })}/>
        <select aria-label="Filter by active status" value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })} className="h-9 min-w-32 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <details className="relative"><summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600">More filters <span className="text-slate-400">⌄</span></summary><div className="absolute left-0 z-10 mt-2 flex w-64 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"><SelectFilter label="Audiences" value={filters.audience} values={options.audiences} onChange={value => setFilters({ ...filters, audience: value })}/><SelectFilter label="Locations" value={filters.location} values={options.locations} onChange={value => setFilters({ ...filters, location: value })}/><select aria-label="Filter by origin" value={filters.origin} onChange={event => setFilters({ ...filters, origin: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"><option value="">All origins</option><option value="generated">Generated</option><option value="manual">Manual</option><option value="legacy">Legacy</option></select><select aria-label="Filter by result" value={filters.result} onChange={event => setFilters({ ...filters, result: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"><option value="">All results</option><option value="mentioned">Mentioned</option><option value="not-mentioned">Not mentioned</option><option value="not-tested">Not tested</option></select></div></details>
        {Object.values(filters).some(Boolean) && <button type="button" onClick={() => setFilters({ category: "", audience: "", location: "", status: "", result: "", origin: "" })} className="px-2 text-xs font-semibold text-blue-700">Clear filters</button>}
      </div>

      <div className="divide-y divide-slate-200">{queryCategories.filter(category => !filters.category || filters.category === category).map(category => {
        const all = library.queries.filter(query => query.category === category);
        const matching = queries.filter(query => query.category === category);
        const active = all.filter(query => query.is_active);
        const expanded = expandedCategories.includes(category);
        const unready = active.filter(query => readiness(query).label !== "Ready for monitoring").length;
        return <section key={category}>
          <button type="button" aria-expanded={expanded} aria-controls={`category-${queryCategories.indexOf(category)}`} onClick={() => setExpandedCategories(current => expanded ? current.filter(item => item !== category) : [...current, category])} className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 focus-visible:outline-blue-600">
            <span><span className="text-sm font-semibold text-slate-800">{category}</span><span className="mt-1 block text-xs text-slate-500">{active.length} active {active.length === 1 ? "query" : "queries"}{Object.values(filters).some(Boolean) ? ` · ${matching.length} match filters` : ""}</span></span>
            <span className="flex items-center gap-4 text-xs text-slate-500"><span>{unready ? `${unready} need attention` : active.length ? "Coverage ready" : "No active coverage"}</span><span aria-hidden="true">{expanded ? "−" : "+"}</span></span>
          </button>
          {expanded && <div id={`category-${queryCategories.indexOf(category)}`} className="border-t border-slate-100 bg-slate-50/50 p-4">
            {matching.length ? <div className="space-y-3">{matching.map(query => <QueryCard key={query.id} query={query} pending={pending} run={run} setActive={setLocalActive}/>)}</div> : <p className="p-4 text-sm text-slate-500">{all.length ? "No queries match these filters." : "No benchmarks in this category yet."}</p>}
          </div>}
        </section>;
      })}</div>
      {!queries.length && <div className="border-t border-slate-100 p-6 text-center"><span className="mx-auto grid size-10 place-items-center rounded-lg bg-blue-50 text-blue-600"><Icon name="search"/></span><p className="mt-3 text-sm font-semibold text-slate-900">{library.error ? "Query library unavailable" : library.queries.length ? "No queries match these filters" : "No benchmark queries yet"}</p><p className="mt-2 text-sm text-slate-500">{library.error ? "Complete database setup, then reload this page." : library.queries.length ? "Clear or adjust the filters to see more queries." : "Refresh Questions to build your benchmark coverage from Truth Hub."}</p></div>}
    </SectionCard>
  </main>;
}

function QueryCard({ query, pending, run, setActive }: { query: SavedQuery; pending: boolean; run: (action: () => Promise<{ error?: string; message?: string }>) => void; setActive: (id: string, active: boolean) => Promise<{ error?: string; message?: string }> }) {
  const latest = query.results[0];
  const status = readiness(query);
  const dimensions = query.evaluation_dimensions ?? [];
  return <article className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold leading-6 text-slate-900">{query.query_text}</h3><p className="mt-1 text-xs text-slate-500">{query.audience}{query.location ? ` · ${query.location}` : ""}{query.intent ? ` · ${query.intent}` : ""}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.style}`}>{status.label}</span></div>
    <div className="mt-3 flex flex-wrap gap-1.5">{dimensions.map(dimension => <span key={dimension} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{dimensionLabels[dimension]}</span>)}{!dimensions.length && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Measurements not defined</span>}</div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><div className="flex flex-wrap items-center gap-2">{latest ? <><span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{latest.mentioned ? "Mentioned" : "Not mentioned"}</span>{showsRecommendation(query) && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{latest.recommended ? "Recommended" : "Not recommended"}</span>}{showsPosition(query) && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">Position {latest.recommendation_position ?? "—"}</span>}<span>Tested {date(latest.tested_at)}</span></> : <span>Not tested</span>}</div><button type="button" onClick={() => run(() => setActive(query.id, !query.is_active))} disabled={pending} className="font-semibold text-blue-700 disabled:opacity-50">{query.is_active ? "Deactivate" : "Activate"}</button></div>
    {query.results.length > 1 && <details className="mt-3 text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-blue-700">Earlier result history ({query.results.length - 1})</summary><div className="mt-3 space-y-3">{query.results.slice(1).map(result => <ResultDetails key={result.id} query={query} result={result} />)}</div></details>}
  </article>;
}

function SummaryItem({ label, value, tone = "default", compact = false }: { label: string; value: string; tone?: "default" | "amber"; compact?: boolean }) {
  return <div className="min-w-0 p-4"><p className={`${compact ? "text-sm leading-5" : "text-2xl"} font-semibold tracking-[-0.02em] ${tone === "amber" ? "text-amber-700" : "text-slate-950"}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>;
}

function FormInput({ label, value, placeholder, required = true, onChange }: { label: string; value: string; placeholder: string; required?: boolean; onChange: (value: string) => void }) {
  return <label><span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span><input required={required} maxLength={200} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"/></label>;
}

function FormSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label><span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500">{values.map(item => <option key={item}>{item}</option>)}</select></label>;
}

function ResultDetails({ query, result }: { query: SavedQuery; result: QueryResult }) {
  const values: [string, string | number][] = [["Mentioned", result.mentioned ? "Yes" : "No"]];
  if (showsRecommendation(query)) values.push(["Recommended", result.recommended ? "Yes" : "No"]);
  if (showsPosition(query)) values.push(["Recommendation position", result.recommendation_position ?? "—"]);
  values.push(["Claims checked", result.claims_checked], ["Claims verified", result.verified_claims], ["Conflicts", result.conflict_count]);
  return <div className="rounded-lg bg-slate-50 p-3"><p className="mb-3 text-slate-500">{result.ai_platform} · {date(result.tested_at)}</p><dl className="grid gap-3 sm:grid-cols-3">{values.map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="mt-1">{value}</dd></div>)}</dl></div>;
}
