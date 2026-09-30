"use client";

import { useState, useTransition } from "react";
import { runWorkspaceMonitoringScan } from "@/app/monitoring/actions";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { calculateMonitoringMetrics } from "@/lib/metrics/monitoring";
import type { QueryResult, SavedQuery } from "@/lib/queries/schema";
import { decodeFact } from "@/lib/truth-fields";
import { Icon } from "./icons";

export function BenchmarkRunner() {
  const { workspace, updateWorkspace } = useWorkspace();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const queries = workspace!.queries.items as unknown as SavedQuery[];
  const hasActiveQueries = queries.some(query => query.is_active);

  function selectedQueries() {
    const active = queries.filter(query => query.is_active).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const selected = [...new Map(active.map(query => [query.category, query])).values()];
    for (const query of active) if (selected.length < 15 && !selected.some(item => item.id === query.id)) selected.push(query);
    return selected.slice(0, 15);
  }

  function scan() {
    setMessage(""); setError("");
    startTransition(async () => {
      const selected = selectedQueries();
      if (!selected.length) { setConfirming(false); return; }
      const aliasKeys = new Set(["alias", "aliases", "business_alias", "business_aliases", "alternate_names"]);
      const aliases = workspace!.truthHub.facts.filter(fact => aliasKeys.has(String(fact.fact_key).toLowerCase())).flatMap(fact => {
        const value = decodeFact(fact.fact_value);
        return Array.isArray(value) ? value.map(String) : String(value ?? "").split(/[;,\n]/).map(item => item.trim()).filter(Boolean);
      });
      const response = await runWorkspaceMonitoringScan({
        business: { id: workspace!.truthHub.business.id, name: String(workspace!.truthHub.business.name), aliases },
        queries: selected.map(query => ({ id: query.id, query_text: query.query_text, category: query.category, audience: query.audience, evaluation_dimensions: query.evaluation_dimensions ?? [], linked_facts: query.truth_links ?? [] })),
      });
      setError(response.error ?? "");
      setMessage(response.run ? `Benchmark complete · ${response.run.query_count} questions tested` : response.message ?? "");
      if (response.run && response.results && response.claims) {
        const idsByName = new Map(workspace!.truthHub.offerings.map(offering => [String(offering.name), offering.id]));
        const queryOfferingIds = Object.fromEntries(queries.map(query => [query.id, [...new Set((query.truth_links ?? []).flatMap(fact => fact.offering && idsByName.has(fact.offering) ? [idsByName.get(fact.offering)!] : []))]]));
        const metricSnapshot = calculateMonitoringMetrics(queries, response.results, queryOfferingIds);
        updateWorkspace(current => ({
          ...current,
          monitoring: {
            ...current.monitoring,
            runs: [{ ...response.run, metric_snapshot: metricSnapshot }, ...current.monitoring.runs],
            results: [...response.results, ...current.monitoring.results],
            claims: [...response.claims, ...current.monitoring.claims],
          },
          queries: {
            ...current.queries,
            items: current.queries.items.map(item => {
              const monitored = response.results.find(result => result.query_id === item.id);
              if (!monitored) return item;
              const queryResult: QueryResult = { id: monitored.id, query_id: monitored.query_id, ai_platform: monitored.provider, tested_at: monitored.tested_at, mentioned: monitored.mentioned, recommended: monitored.recommended, recommendation_position: monitored.recommendation_position, response_text: monitored.raw_response_text, response_reference: null, claims_checked: monitored.claims_checked, verified_claims: monitored.verified_claims, accuracy_percentage: monitored.claims_checked ? monitored.verified_claims / monitored.claims_checked * 100 : null, conflict_count: monitored.conflict_count };
              return { ...item, results: [queryResult, ...(Array.isArray(item.results) ? item.results : [])] };
            }),
          },
        }));
      }
      setConfirming(false);
    });
  }

  return <div className="relative">
    <button type="button" onClick={() => setConfirming(true)} disabled={pending || !hasActiveQueries} title={hasActiveQueries ? undefined : "Refresh Questions or add a question before running a benchmark."} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Icon name="play"/>{pending ? "Benchmark running…" : "Run Benchmark"}</button>
    {confirming && <div role="dialog" aria-label="Confirm benchmark" className="fixed left-1/2 top-24 z-30 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-left shadow-xl"><p className="text-sm leading-6 text-slate-700">Run up to 15 active questions? This makes one OpenAI request per selected question and saves the evidence in this browser.</p><div className="mt-3 flex gap-2"><button type="button" onClick={scan} disabled={pending} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Running…" : "Run benchmark"}</button><button type="button" onClick={() => setConfirming(false)} disabled={pending} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button></div></div>}
    {error && <p role="alert" className="fixed bottom-5 right-5 z-30 max-w-sm rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 shadow-lg">{error}</p>}
    {message && <p role="status" className="fixed bottom-5 right-5 z-30 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800 shadow-lg">{message}</p>}
  </div>;
}
