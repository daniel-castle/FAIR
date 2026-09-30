"use client";

import { useState } from "react";
import type { SavedQuery } from "@/lib/queries/schema";
import { dimensionLabels, evaluationDimensions, type EvaluationDimension, type TruthFact } from "@/lib/queries/evaluation";

export function batchTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(new Date(value));
}
export type EvaluationSelection = { dimensions: EvaluationDimension[]; fact_ids: string[] };

export function EvaluationFields({ selection, onChange, facts, disabled = false }: {
  selection: EvaluationSelection; onChange: (value: EvaluationSelection) => void; facts: TruthFact[]; disabled?: boolean;
}) {
  return <div className="space-y-4">
    <fieldset disabled={disabled}><legend className="mb-2 text-xs font-semibold text-slate-800">What will FAIR measure? Choose at least one.</legend><div className="flex flex-wrap gap-x-5 gap-y-2">{evaluationDimensions.map(dimension => <label key={dimension} className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" className="accent-blue-600" checked={selection.dimensions.includes(dimension)} onChange={event => onChange({ ...selection, dimensions: event.target.checked ? [...selection.dimensions, dimension] : selection.dimensions.filter(item => item !== dimension) })}/>{dimensionLabels[dimension]}</label>)}</div></fieldset>
    <fieldset disabled={disabled}><legend className="mb-2 text-xs font-semibold text-slate-800">Which verified Truth Hub facts matter?</legend><p className="mb-2 text-xs text-slate-500">Select actual facts relevant to this question. Leave unlinked when the required truth is missing.</p><div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">{facts.filter(fact => fact.verified).map(fact => <label key={fact.id} className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" className="mt-0.5 accent-blue-600" checked={selection.fact_ids.includes(fact.id)} onChange={event => onChange({ ...selection, fact_ids: event.target.checked ? [...selection.fact_ids, fact.id] : selection.fact_ids.filter(id => id !== fact.id) })}/><span className="min-w-0 break-words"><b>{fact.offering ? `${fact.offering} · ` : ""}{fact.key.replaceAll("_", " ")}</b><br/>{fact.value}</span></label>)}{!facts.some(fact => fact.verified) && <p className="text-xs text-slate-500">No verified facts available. Add and verify information in Truth Hub.</p>}</div></fieldset>
  </div>;
}

export function BenchmarkDefinition({ query, facts, unavailable, pending, onSave }: {
  query: SavedQuery; facts: TruthFact[]; unavailable?: string; pending: boolean; onSave: (value: EvaluationSelection) => void;
}) {
  const [selection, setSelection] = useState<EvaluationSelection>({ dimensions: query.evaluation_dimensions ?? [], fact_ids: (query.truth_links ?? []).filter(fact => fact.verified).map(fact => fact.id) });
  const dimensions = query.evaluation_dimensions ?? [];
  const links = query.truth_links ?? [];
  return <>
    <section><h4 className="mb-2 font-semibold text-slate-900">Why this matters</h4><p className="leading-5 text-slate-600">{query.intent}</p></section>
    <section><h4 className="mb-3 font-semibold text-slate-900">What will FAIR measure?</h4>{dimensions.length ? <div className="flex flex-wrap gap-2">{dimensions.map(dimension => <span key={dimension} className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{dimensionLabels[dimension]}</span>)}</div> : <p>Evaluation targets not defined yet. Review this benchmark before future scans.</p>}</section>
    {dimensions.includes("factual_accuracy") && <section><h4 className="mb-3 font-semibold text-slate-900">Verified benchmark</h4>{unavailable ? <p className="text-amber-700">{unavailable}</p> : links.some(fact => fact.verified) ? <div className="space-y-2">{links.filter(fact => fact.verified).map(fact => <div key={fact.id}><p className="font-semibold capitalize text-slate-800">{fact.offering ? `${fact.offering} · ` : ""}{fact.key.replaceAll("_", " ")}</p><p className="mt-1 break-words text-slate-600">{fact.value}</p></div>)}</div> : <p className="font-semibold text-amber-700">Truth information missing — add or link a verified fact before accuracy testing.</p>}</section>}
    <details><summary className="cursor-pointer font-semibold text-slate-500 hover:text-blue-700">Manage benchmark</summary><form className="mt-3 space-y-4 rounded-lg border border-slate-200 p-4" onSubmit={event => { event.preventDefault(); onSave(selection); }}><p className="text-slate-500">Advanced settings control measurement targets and canonical Truth Hub links.</p><EvaluationFields selection={selection} onChange={setSelection} facts={facts} disabled={pending || !!unavailable}/><button disabled={pending || !!unavailable || !selection.dimensions.length} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50">Save benchmark</button></form></details>
  </>;
}
