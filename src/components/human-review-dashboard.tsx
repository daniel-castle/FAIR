"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { MiniStat, SectionCard, StatusBadge } from "@/components/ui";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import type { SpecialistRecommendation, SpecialistReviewRequest } from "@/lib/monitoring/schema";
import { humanReviewItems, saveSpecialistRecommendation, saveSpecialistReviewRequest, type HumanReviewItem } from "@/lib/workspace/human-review";

function customerStatus(item: HumanReviewItem, hasRequest: boolean) {
  if (item.review?.resolved) return { label: "Reviewed", state: item.review.human_status === "conflict" ? "conflict" as const : "verified" as const };
  if (hasRequest || item.review) return { label: "Under review", state: "review" as const };
  return { label: "Awaiting specialist review", state: "review" as const };
}

function FindingCard({ item, hasRequest }: { item: HumanReviewItem; hasRequest: boolean }) {
  const status = customerStatus(item, hasRequest);
  const flag = item.claim.verification_status === "conflict" ? "FAIR found an AI value that differs from the verified Truth Hub value." : "FAIR could not determine the claim confidently from the AI response.";
  return <SectionCard><article className="p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Benchmark question</p><h2 className="mt-1 text-base font-semibold text-slate-950">{item.queryText}</h2><p className="mt-1 text-sm text-slate-500">{item.businessName}{item.claim.offering ? ` · ${item.claim.offering}` : ""} · {item.claim.fact_key?.replaceAll("_", " ") ?? item.claim.subject}</p></div><StatusBadge state={status.state} label={status.label}/></div>
    <div className="mt-5 grid gap-3 lg:grid-cols-2"><div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Verified Truth Hub value</p><p className="mt-2 text-sm font-medium leading-6 text-slate-800">{item.claim.canonical_value_snapshot ?? "No comparable linked fact"}</p></div><div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Relevant AI evidence</p><p className="mt-2 text-sm leading-6 text-slate-700">{item.claim.observed_value || "No value extracted"}</p></div></div>
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Why FAIR flagged this</p><p className="mt-2 text-sm leading-6 text-slate-700">{flag}</p><p className="mt-2 text-xs leading-5 text-slate-500">AI response excerpt: “{item.claim.evidence_text}”</p><details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-blue-700">View full AI response</summary><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.rawResponse}</p></details></div>
  </article></SectionCard>;
}

function RecommendationCard({ item, onComplete }: { item: SpecialistRecommendation; onComplete: () => void }) {
  const status = item.status === "completed" ? "Completed" : item.status === "in_progress" ? "In progress" : "Recommended";
  const action = item.recommended_next_action || item.specialist_note || "FAIR specialists will share the recommended next step.";
  return <article className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{item.title}</h3><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${item.priority === "high" ? "bg-red-50 text-red-700" : item.priority === "medium" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{item.priority} priority</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{item.rationale}</p><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-blue-700">Linked finding</p><p className="mt-1 text-sm text-slate-700">{item.linked_evidence}</p><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended next action</p><p className="mt-1 text-sm text-slate-700">{action}</p></div><StatusBadge state={item.status === "completed" ? "verified" : item.status === "in_progress" ? "review" : "review"} label={status}/></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-[11px] text-slate-400">Created {new Date(item.created_at).toLocaleString()} · Updated {new Date(item.updated_at).toLocaleString()}</p>{item.status !== "completed" && <button type="button" onClick={onComplete} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Mark action completed</button>}</div></article>;
}

export function HumanReviewDashboard() {
  const { workspace, updateWorkspace } = useWorkspace();
  const [requested, setRequested] = useState(false);
  const items = useMemo(() => humanReviewItems(workspace!), [workspace]);
  const recommendations = (workspace!.monitoring.recommendations ?? []) as unknown as SpecialistRecommendation[];
  const existingRequest = (workspace!.monitoring.specialist_review_requests ?? []) as unknown as SpecialistReviewRequest[];
  const hasRequest = requested || existingRequest.some(request => request.status === "requested");
  const reviewed = items.filter(item => item.review?.resolved);
  const awaiting = items.filter(item => !item.review?.resolved);
  function requestReview() { const request: SpecialistReviewRequest = { id: crypto.randomUUID(), status: "requested", requested_at: new Date().toISOString() }; updateWorkspace(current => saveSpecialistReviewRequest(current, request)); setRequested(true); }
  return <main className="space-y-7 border-t border-slate-200 bg-[#f8fafc] p-5 lg:p-7">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><SectionCard><div className="p-4"><MiniStat label="Awaiting specialist review" value={String(awaiting.length)} tone="amber"/></div></SectionCard><SectionCard><div className="p-4"><MiniStat label="Reviewed findings" value={String(reviewed.length)} tone="green"/></div></SectionCard><SectionCard><div className="p-4"><MiniStat label="Specialist recommendations" value={String(recommendations.length)} tone="blue"/></div></SectionCard><SectionCard><div className="p-4"><MiniStat label="Completed actions" value={String(recommendations.filter(item => item.status === "completed").length)} tone="green"/></div></SectionCard></div>
    <section className="space-y-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-blue-700">Specialist Review Queue</p><h2 className="mt-1 text-lg font-semibold text-slate-950">What FAIR’s human team is reviewing</h2><p className="mt-1 text-sm text-slate-500">Conflicting or uncertain benchmark evidence is automatically queued for FAIR specialists.</p></div>{!hasRequest && <button type="button" onClick={requestReview} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Request specialist review</button>}{hasRequest && <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">Specialist review requested</p>}</div>
      {items.length ? <div className="space-y-4">{items.map(item => <FindingCard key={item.claim.id} item={item} hasRequest={hasRequest}/>)}</div> : <SectionCard><div className="p-10 text-center"><span className="mx-auto grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon name="shield"/></span><h2 className="mt-4 text-base font-semibold text-slate-950">No findings need specialist review</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">When a benchmark finds a conflict or needs human judgment, it will appear here automatically.</p></div></SectionCard>}
    </section>
    <section className="space-y-4"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-blue-700">Specialist Guidance</p><h2 className="mt-1 text-lg font-semibold text-slate-950">What to do next</h2><p className="mt-1 text-sm text-slate-500">Recommendations are provided by FAIR specialists and tied to your benchmark findings.</p></div><SectionCard>{recommendations.length ? <div className="divide-y divide-slate-200">{recommendations.map(item => <RecommendationCard key={item.id} item={item} onComplete={() => updateWorkspace(current => saveSpecialistRecommendation(current, { ...item, status: "completed", updated_at: new Date().toISOString() }))}/>)}</div> : <div className="p-10 text-center"><span className="mx-auto grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon name="clock"/></span><h2 className="mt-4 text-base font-semibold text-slate-950">No specialist guidance yet</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">FAIR specialists have not added guidance yet. Findings requiring human judgment are queued for review.</p></div>}</SectionCard></section>
  </main>;
}
