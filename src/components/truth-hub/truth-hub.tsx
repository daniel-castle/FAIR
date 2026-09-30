"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { businessTemplates, type TemplateField } from "@/data/business-templates";
import { display, verified, type HubData, type Row } from "@/lib/truth-hub";
import { loadTruthHub, saveTruthHub } from "@/app/truth-hub/actions";
import { FieldGroups, GuidedFieldEditor, OfferingEditor } from "./guided-forms";
import { friendlyValue, hasValue, readField } from "@/lib/truth-fields";
import { ProgressBar, SectionCard, StatusBadge } from "@/components/ui";

const control = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-blue-600";
function Action({ children, onClick, disabled, primary = false }: { children: ReactNode; onClick?: () => void; disabled?: boolean; primary?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${primary ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-blue-700 hover:bg-blue-50"}`}>{children}</button>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1.5 text-xs font-medium text-slate-600">{label}{children}</label>; }
function date(row: Row) { const value = row.updated_at ?? row.created_at; return value ? new Date(String(value)).toLocaleDateString("en-US", { timeZone: "UTC" }) : "Not recorded"; }
type Editor = { kind: "offering" | "fact" | "business" | "source"; row?: Row; key?: string; offeringId?: string };

export function TruthHub({ initial }: { initial: HubData }) {
  const [data, setData] = useState(initial);
  const [templateId, setTemplateId] = useState(() => {
    const stored = initial.facts.find(f => !f.offering_id && f.fact_key === "business_template")?.fact_value;
    if (businessTemplates.some(t => t.id === stored)) return String(stored);
    const industry = String(initial.business?.industry ?? "").toLowerCase();
    return businessTemplates.find(t => t.id !== "generic" && (industry.includes(t.id) || industry.includes(t.label.split(" / ")[0].toLowerCase())))?.id ?? "generic";
  });
  const [guided, setGuided] = useState<{ field: TemplateField; offeringId?: string } | null>(null);
  const [offeringEditor, setOfferingEditor] = useState<{ row?: Row } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [importMode, setImportMode] = useState<"csv" | "file" | null>(null);
  const [filename, setFilename] = useState("");
  const template = businessTemplates.find(t => t.id === templateId)!;
  const businessFacts = data.facts.filter(f => !f.offering_id && f.fact_key !== "business_template");
  const fields = template.fields.filter(f => f.scope === "business");
  const recommended = fields.filter(f => f.required || f.recommended);
  const offeringRecommended = template.fields.filter(f => f.scope === "offering" && (f.required || f.recommended));
  const total = 1 + recommended.length + (data.offerings.length || 1) * offeringRecommended.length;
  const completed = (data.business?.name ? 1 : 0) + recommended.filter(f => hasValue(readField(data.facts, f, data.business))).length + data.offerings.reduce((n, o) => n + offeringRecommended.filter(f => hasValue(readField(data.facts, f, data.business, o.id))).length, 0);
  const completion = Math.round(completed / total * 100);
  const missing = [...recommended.filter(f => !hasValue(readField(data.facts, f, data.business))).map(f => f.label), ...offeringRecommended.filter(f => !data.offerings.length || data.offerings.some(o => !hasValue(readField(data.facts, f, data.business, o.id)))).map(f => f.label === "Price" ? "Pricing" : `Offering ${f.label.toLowerCase()}`)];
  async function refreshed() { setData(await loadTruthHub()); setNotice("Saved to Supabase."); }
  const active = data.offerings.find(o => o.id === selected);
  const canEdit = !!data.business && !busy;

  async function mutate(input: Parameters<typeof saveTruthHub>[0]) {
    setBusy(true); setNotice("");
    try {
      const result = await saveTruthHub(input);
      if (result.error) { setNotice(result.error); return; }
      setData(await loadTruthHub()); setEditor(null); setNotice(input.remove ? "Deleted from Supabase." : "Saved to Supabase.");
      if (input.remove && input.table === "offerings") setSelected(null);
    } catch { setNotice("Could not reach Supabase. Your changes have not been confirmed; please retry."); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editor) return;
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const table = editor.kind === "offering" ? "offerings" : editor.kind === "fact" ? "facts" : editor.kind === "source" ? "sources" : "businesses";
    const values = editor.kind === "offering" ? { name: text("name"), offering_type: text("offering_type"), description: text("description") } : editor.kind === "fact" ? { fact_key: editor.row?.fact_key ?? text("fact_key").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), fact_value: text("fact_value"), verified: form.get("verified") === "on", offering_id: editor.offeringId ?? editor.row?.offering_id ?? null } : editor.kind === "source" ? { name: text("name"), url: text("url"), source_type: "website", status: "needs_review" } : { name: text("name") };
    await mutate({ table, id: editor.row?.id, values });
  }
  const factList = (facts: Row[]) => facts.length ? <div className="divide-y divide-slate-100">{facts.map(f => <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className="text-xs text-slate-500">{display(f.fact_key).replaceAll("_", " ")}</p><p className="mt-1 break-words font-medium">{friendlyValue(f.fact_value)}</p></div><div className="flex items-center gap-2"><StatusBadge state={verified(f) ? "verified" : "review"} /><Action disabled={!canEdit} onClick={() => setEditor({ kind: "fact", row: f })}>Edit</Action><Action disabled={!canEdit} onClick={() => { if (confirm("Delete this fact?")) void mutate({ table: "facts", id: f.id, remove: true }); }}>Delete</Action></div></div>)}</div> : <p className="p-5 text-sm text-slate-500">No facts yet. Add the details customers should know.</p>;

  return <main className="space-y-5 border-t border-slate-200 bg-[#f8fafc] p-5 lg:p-7">
    {data.errors.length > 0 && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{data.errors.join(" ")} <button className="ml-2 underline" onClick={async () => { setBusy(true); try { setData(await loadTruthHub()); } finally { setBusy(false); } }} disabled={busy}>Retry connection</button></div>}
    {notice && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
    <SectionCard><div className="grid gap-6 p-5 lg:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Business control center</p><h2 className="mt-2 text-xl font-semibold">{data.business ? display(data.business.name) : "Your business truth profile"}</h2><p className="mt-1 text-sm text-slate-500">{template.label}</p><div className="mt-5 flex justify-between text-sm font-semibold"><span>Truth Profile</span><span className="text-blue-700">{completion}% Complete</span></div><div className="mt-3"><ProgressBar value={completion} /></div><p className="mt-2 text-xs text-slate-500">{completed} of {total} recommended details complete</p>{missing.length > 0 && <p className="mt-2 text-xs text-amber-700">Missing: {[...new Set(missing)].join(" · ")}</p>}</div><div className="grid grid-cols-3 items-center gap-3 lg:border-l lg:border-slate-100 lg:pl-6">{[["Verified facts", data.facts.filter(verified).length], ["Offerings", data.offerings.length], ["Sources", data.sources.length]].map(([label, count]) => <div key={label}><p className="text-3xl font-semibold text-slate-900">{count}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}</div></div></SectionCard>
    <SectionCard title="Business template" description="Choose the questions that fit your business. Your existing facts stay available."><div className="grid gap-4 p-5 md:grid-cols-2"><Field label="Template"><select className={control} value={templateId} disabled={!canEdit} onChange={async e => {
        const id = e.target.value; setBusy(true); setNotice("");
        try {
          const existing = data.facts.find(f => !f.offering_id && f.fact_key === "business_template");
          const result = await saveTruthHub({ table: "facts", id: existing?.id, values: { fact_key: "business_template", fact_value: id, verified: true, offering_id: null } });
          if (result.error) { setNotice(result.error); return; }
          setTemplateId(id); await refreshed();
        } catch { setNotice("Template could not be saved. Please retry."); } finally { setBusy(false); }
      }}>{businessTemplates.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field><div className="self-center text-sm text-slate-500"><p>{template.description}</p><p className="mt-1 text-xs">{data.facts.some(f => f.fact_key === "business_template" && !f.offering_id) ? "Saved to your business profile" : "Suggested from your industry · choose a template to save your preference"}</p></div></div></SectionCard>
    <SectionCard title="Business Information" description="Choose a detail to update. Recommended information contributes to your profile.">
      <div className="flex items-center justify-between gap-3 p-5"><div><p className="text-xs text-slate-500">Business name</p><p className="mt-1 font-semibold">{display(data.business?.name)}</p></div><Action disabled={!canEdit} onClick={() => setEditor({ kind: "business", row: data.business! })}>Edit name</Action></div>
    </SectionCard>
    <FieldGroups data={data} template={template} disabled={!canEdit} onEdit={field => setGuided({ field })} />
    <details className="rounded-xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-slate-600">Advanced / Custom Facts</summary><div className="mt-4"><Action disabled={!canEdit} onClick={() => setEditor({ kind: "fact" })}>+ Add Custom Fact</Action>{factList(businessFacts.filter(f => !fields.some(field => field.key === f.fact_key || field.aliases?.includes(String(f.fact_key)))))}</div></details>
    <SectionCard title="Products & Services" description="One catalog for products, menu items, and services." action={<Action primary disabled={!canEdit} onClick={() => setOfferingEditor({})}>Add Offering</Action>}>
      {data.offerings.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr>{["Offering", "Type", "Category / key facts", "Verification", "Last updated", "Actions"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{data.offerings.map(o => { const facts = data.facts.filter(f => f.offering_id === o.id); return <tr key={o.id}><td className="font-semibold">{display(o.name)}</td><td>{display(o.offering_type)}</td><td><div className="max-w-xs text-xs">{facts.slice(0, 3).map(f => `${display(f.fact_key)}: ${friendlyValue(f.fact_value)}`).join(" · ") || "No facts added"}</div></td><td><StatusBadge state={facts.length && facts.every(verified) ? "verified" : "review"} /></td><td className="whitespace-nowrap text-xs">{date(o)}</td><td><div className="flex gap-2"><Action onClick={() => setSelected(o.id)}>View Details</Action><Action disabled={!canEdit} onClick={() => setOfferingEditor({ row: o })}>Edit</Action><Action disabled={!canEdit} onClick={() => { if (confirm("Delete this offering? Associated facts may also be removed by the database.")) void mutate({ table: "offerings", id: o.id, remove: true }); }}>Delete</Action></div></td></tr>; })}</tbody></table></div> : <div className="p-10 text-center"><p className="font-semibold">Build your trusted catalog</p><p className="mt-2 text-sm text-slate-500">Add your first product or service, then attach prices, attributes, and policies.</p></div>}
    </SectionCard>
    {active && <SectionCard title={display(active.name)} description={display(active.description)} action={<Action onClick={() => setSelected(null)}>Close details</Action>}>
      <div className="space-y-4 bg-slate-50 p-4"><Action disabled={!canEdit} onClick={() => setOfferingEditor({ row: active })}>Edit product or service</Action><FieldGroups data={data} template={template} offering={active} disabled={!canEdit} onEdit={field => setGuided({ field, offeringId: active.id })} />
      <details className="rounded-lg border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-semibold">Verification & sources</summary><div className="mt-3 space-y-3">{data.facts.filter(f => f.offering_id === active.id).map(f => <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{String(f.fact_key).replaceAll("_", " ")} · Source: {String(data.sources.find(s => s.id === f.source_id)?.name ?? "Not linked")} · {date(f)}</span><StatusBadge state={verified(f) ? "verified" : "review"} /></div>)}</div></details>
      <details className="rounded-lg border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-600">Advanced / Custom Facts</summary><div className="mt-4"><Action disabled={!canEdit} onClick={() => setEditor({ kind: "fact", offeringId: active.id })}>+ Add Custom Fact</Action>{factList(data.facts.filter(f => f.offering_id === active.id && !template.fields.some(field => field.scope === "offering" && (field.key === f.fact_key || field.aliases?.includes(String(f.fact_key))))))}</div></details>
      </div></SectionCard>}
    <SectionCard title="Add / Import Data" description="Bring business knowledge together, then review it before verification."><div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">{[
      { label: "Manual Entry", description: "Add a product or service and edit its facts.", action: () => setOfferingEditor({}), disabled: !canEdit },
      { label: "Upload CSV", description: "Select a CSV and explore the planned mapping flow.", tag: "Prototype", action: () => { setFilename(""); setImportMode("csv"); } },
      { label: "Spreadsheet Import", description: "Bring in workbook and spreadsheet catalogs.", tag: "Coming Soon", disabled: true },
      { label: "Upload File", description: "PDFs, menus, and price sheets as future source material.", tag: "Prototype", action: () => { setFilename(""); setImportMode("file"); } },
      { label: "Add Website", description: "Save a website URL as a source. Crawling is not enabled.", action: () => setEditor({ kind: "source" }), disabled: !canEdit },
      { label: "Connect Feed", description: "Product feeds, commerce platforms, and API connections.", tag: "Coming Soon", disabled: true },
    ].map(item => <div key={item.label} className="rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{item.label}</h3>{item.tag && <span className="text-[10px] font-semibold uppercase text-slate-500">{item.tag}</span>}</div><p className="mb-4 mt-2 min-h-10 text-xs leading-5 text-slate-500">{item.description}</p><Action disabled={item.disabled} onClick={item.action}>{item.label}</Action></div>)}</div>
      {importMode && <div className="mx-5 mb-5 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4"><div className="flex justify-between"><h3 className="font-semibold">{importMode === "csv" ? "CSV mapping preview" : "File source preview"} · Prototype</h3><Action onClick={() => setImportMode(null)}>Close</Action></div><input aria-label="Select source file" type="file" accept={importMode === "csv" ? ".csv" : ".pdf,.txt,.doc,.docx,.png,.jpg"} onChange={e => setFilename(e.target.files?.[0]?.name ?? "")} />{filename && <p className="text-sm">Selected: {filename}</p>}{importMode === "csv" && <p className="text-xs">Planned mapping: name → offering · price / attributes → facts · file → source</p>}<p className="text-xs text-slate-600">Preview only. Files are not uploaded or saved. {importMode === "csv" ? "CSV parsing and import are coming soon." : "File storage and metadata ingestion are coming soon; OCR and extraction are not enabled."}</p><Action disabled>{importMode === "csv" ? "Import · Coming Soon" : "Upload · Coming Soon"}</Action></div>}
    </SectionCard>
    <SectionCard title="Sources" description="Where your business information comes from." action={<Action disabled={!canEdit} onClick={() => setEditor({ kind: "source" })}>Add Source</Action>}>{data.sources.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr>{["Source", "Type", "Status", "Last updated", "Facts"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{data.sources.map(s => <tr key={s.id}><td className="font-medium">{display(s.name)}</td><td>{display(s.source_type)}</td><td><StatusBadge state={s.status === "current" ? "verified" : "review"} label={s.status === "current" ? "Current" : s.status === "outdated" ? "Outdated" : "Needs Review"} /></td><td>{date(s)}</td><td>{data.facts.filter(f => f.source_id === s.id).length}</td></tr>)}</tbody></table></div> : <div className="p-10 text-center"><p className="font-semibold">No sources added yet</p><p className="mt-2 text-sm text-slate-500">Add a website to record where your information comes from.</p></div>}</SectionCard>
    {guided && <GuidedFieldEditor field={guided.field} offeringId={guided.offeringId} data={data} template={template} close={() => setGuided(null)} saved={refreshed} />}
    {offeringEditor && <OfferingEditor offering={offeringEditor.row} data={data} template={template} close={() => setOfferingEditor(null)} saved={refreshed} />}
    {editor && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-5"><section role="dialog" aria-modal="true" aria-labelledby="editor-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"><h2 id="editor-title" className="text-lg font-semibold">{editor.row ? "Edit" : "Add"} {editor.kind === "business" ? "business name" : editor.kind}</h2><form onSubmit={submit} className="mt-5 space-y-4">
      {editor.kind !== "fact" && <Field label="Name"><input autoFocus required maxLength={200} name="name" defaultValue={editor.row ? display(editor.row.name) : ""} className={control} /></Field>}
      {editor.kind === "offering" && <><Field label="Offering type"><input required name="offering_type" placeholder="product, service, or menu item" defaultValue={String(editor.row?.offering_type ?? "service")} className={control} /></Field><Field label="Description"><textarea name="description" defaultValue={String(editor.row?.description ?? "")} className={control} /></Field><p className="text-xs text-slate-500">After saving, open View Details to add prices, categories, and other facts.</p></>}
      {editor.kind === "fact" && <><Field label="Fact name"><input autoFocus required name="fact_key" list="fact-suggestions" defaultValue={String(editor.row?.fact_key ?? editor.key ?? "").replaceAll("_", " ")} placeholder="price, warranty, hours…" className={control} /><datalist id="fact-suggestions">{template.fields.filter(f => f.scope === (editor.offeringId || editor.row?.offering_id ? "offering" : "business")).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</datalist></Field><Field label="Value"><textarea required name="fact_value" defaultValue={editor.row ? display(editor.row.fact_value) : ""} className={control} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="verified" defaultChecked={editor.row ? verified(editor.row) : false} /> I have verified this information</label></>}
      {editor.kind === "source" && <><Field label="Website URL"><input required type="url" pattern="https?://.*" name="url" placeholder="https://example.com/catalog" className={control} /></Field><p className="text-xs text-slate-500">Saves a website source for review. No crawling or extraction runs.</p></>}
      {notice && <p role="alert" className="text-sm text-red-700">{notice}</p>}<div className="flex justify-end gap-2"><Action disabled={busy} onClick={() => { setEditor(null); setNotice(""); }}>Cancel</Action><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button></div>
    </form></section></div>}
  </main>;
}
