"use client";

import { useState, useTransition } from "react";
import { analyzeBenchmarkQuery, generateBenchmarkQueries, type QueryLibrary } from "@/app/queries/actions";
import { SectionCard } from "@/components/ui";
import { queryCategories } from "@/lib/queries/schema";

export function QueryLibraryView({ library }: { library: QueryLibrary }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const queries = library.queries.filter(q => !category || q.category === category);
  function analyze(id: string) {
    setError(""); setMessage("");
    startTransition(async () => {
      try {
        const result = await analyzeBenchmarkQuery(id);
        setError(result.error ?? ""); setMessage(result.message ?? "");
      } catch { setError("Analysis was interrupted. Reload to check saved details before retrying."); }
    });
  }
  function generate() {
    setError(""); setMessage("");
    startTransition(async () => {
      try {
        const result = await generateBenchmarkQueries();
        setError(result.error ?? ""); setMessage(result.message ?? "");
      } catch { setError("The request was interrupted. Reload the library to check for saved queries before retrying."); }
    });
  }
  return <main className="space-y-5 border-t border-slate-200 bg-[#f8fafc] p-5 lg:p-7">
    <SectionCard title="Generate Benchmark Queries" description={`Turn Truth Hub information for ${library.businessName} into realistic customer searches.`}>
      <div className="flex flex-wrap items-center justify-between gap-4 p-5"><p className="max-w-xl text-sm leading-6 text-slate-500">Generate 10–15 queries from your business profile, offerings, and verified facts. Queries are saved to your library; AI monitoring comes next.</p><button onClick={generate} disabled={pending || !!library.error || !!library.setup} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Generating and saving…" : "Generate Benchmark Queries"}</button></div>
    </SectionCard>
    {(library.error || library.setup || library.analysisSetup || error) && <div role="alert" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{[library.error, library.setup, library.analysisSetup, error].filter(Boolean).map((text, i) => <p key={i}>{text}</p>)}</div>}
    {message && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</p>}
    <SectionCard title="Benchmark query library" description={`${library.queries.length} saved queries · ${new Set(library.queries.map(q => q.category)).size} categories`} action={<select aria-label="Filter by category" value={category} onChange={e => setCategory(e.target.value)} className="max-w-48 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600"><option value="">All categories</option>{queryCategories.map(c => <option key={c}>{c}</option>)}</select>}>
      {queries.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Query</th><th>Category</th><th>Audience</th><th>Intent</th></tr></thead><tbody>{queries.map(q => <tr key={q.id}><td className="min-w-72 font-semibold text-slate-800">{q.query_text}<details className="mt-3 text-xs font-normal text-slate-600"><summary className="cursor-pointer font-semibold text-blue-700">Query Details</summary>{q.analysis ? <dl className="mt-3 grid gap-2">{Object.entries(q.analysis).map(([key, value]) => <div key={key}><dt className="font-semibold capitalize">{key.replaceAll("_", " ")}</dt><dd className="mt-0.5">{Array.isArray(value) ? value.join(", ") || "Not specified" : value ?? "Not specified"}</dd></div>)}</dl> : <div className="mt-3"><p className="mb-2">Parse what this query asks for. One manual AI request; no monitoring.</p><button type="button" onClick={() => analyze(q.id)} disabled={pending || !!library.setup || !!library.analysisSetup} className="rounded-lg border border-blue-200 px-3 py-2 font-semibold text-blue-700 disabled:opacity-50">{pending ? "Working…" : "Analyze Query"}</button></div>}</details></td><td><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{q.category}</span></td><td className="text-sm">{q.audience}</td><td className="text-sm">{q.intent}</td></tr>)}</tbody></table></div> : <div className="p-10 text-center"><p className="font-semibold text-slate-900">{library.error ? "Query library unavailable" : category ? "No queries in this category" : "No benchmark queries yet"}</p><p className="mt-2 text-sm text-slate-500">{library.error ? "Complete database setup, then reload this page." : "Generate a set from Truth Hub to start your benchmark library."}</p></div>}
    </SectionCard>
  </main>;
}
