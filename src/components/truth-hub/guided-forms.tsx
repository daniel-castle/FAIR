"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { offeringFields, type BusinessTemplate, type TemplateField } from "@/data/business-templates";
import { fieldValue, findFact, friendlyValue, hasValue, objectValue, readField, type FieldValue } from "@/lib/truth-fields";
import { verified, type HubData, type Row } from "@/lib/truth-hub";
import { saveGuidedField, saveGuidedOffering } from "@/app/truth-hub/actions";
import { SectionCard, StatusBadge } from "@/components/ui";
import { TypedInput, inputStyle } from "./typed-input";

const button = "rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-40";
function Modal({ title, children, close, busy }: { title: string; children: ReactNode; close: () => void; busy: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); if (!busy) close(); }} className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/40"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button className={button} type="button" disabled={busy} onClick={close}>Close</button></div>{children}</dialog>;
}
export function FieldGroups({ data, template, offering, onEdit, disabled }: { data: HubData; template: BusinessTemplate; offering?: Row; onEdit: (field: TemplateField) => void; disabled: boolean }) {
  const fields = offering ? offeringFields(template, String(offering.offering_type)) : template.fields.filter(f => f.scope === "business");
  const sections = [...new Set(fields.map(f => f.section))];
  return <div className="grid items-start gap-4 xl:grid-cols-2">{sections.map(section => {
    const group = fields.filter(f => f.section === section);
    const recommended = group.filter(f => f.required || f.recommended);
    const done = recommended.filter(f => hasValue(readField(data.facts, f, data.business, offering?.id))).length;
    return <SectionCard key={section} title={section} description={recommended.length ? `${done} / ${recommended.length} recommended details complete` : "Optional details that help customers"}><div className="divide-y divide-slate-100">{group.map(field => {
      const row = findFact(data.facts, field, offering?.id);
      const value = readField(data.facts, field, data.business, offering?.id);
      return <div className="flex items-start justify-between gap-3 p-4" key={field.key}><div className="min-w-0"><p className="text-sm font-semibold">{field.label}{field.recommended && !hasValue(value) && <span className="ml-2 text-xs font-normal text-amber-700">Recommended</span>}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{friendlyValue(value)}</p>{row && <div className="mt-2"><StatusBadge state={verified(row) ? "verified" : "review"} /></div>}</div><button className={button} type="button" disabled={disabled} onClick={() => onEdit(field)}>{hasValue(value) ? "Edit" : "Add"}</button></div>;
    })}</div></SectionCard>;
  })}</div>;
}
export function GuidedFieldEditor({ field, data, template, offeringId, close, saved }: { field: TemplateField; data: HubData; template: BusinessTemplate; offeringId?: string; close: () => void; saved: () => Promise<void> }) {
  const existing = findFact(data.facts, field, offeringId);
  const initial = readField(data.facts, field, data.business, offeringId);
  const [value, setValue] = useState<FieldValue>(() => fieldValue(field, initial));
  const [checked, setChecked] = useState(existing ? verified(existing) : false);
  const [custom, setCustom] = useState(false);
  const [customText, setCustomText] = useState(typeof initial === "string" ? initial : friendlyValue(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const structured = ["hours", "currency", "location"].includes(field.type);
  const legacy = structured && hasValue(initial) && !objectValue(fieldValue(field, initial));
  return <Modal title={`Edit ${field.label}`} close={close} busy={busy}><form className="space-y-5" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const result = await saveGuidedField({ templateId: template.id, key: field.key, value: custom ? customText : value, offeringId, verified: checked, custom });
      if (result.error) { setError(result.error); return; }
      await saved(); close();
    } catch { setError("Could not confirm the save. Reload before trying again."); } finally { setBusy(false); }
  }}><fieldset disabled={busy} className="space-y-5">
    {legacy && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Current information: {friendlyValue(initial)}. Enter structured details below to replace it, or keep using custom text.</p>}
    {custom ? <label className="grid gap-2 text-sm">Custom text<textarea required className={inputStyle} value={customText} onChange={e => setCustomText(e.target.value)} /></label> : <TypedInput field={field} value={value} onChange={setValue} />}
    {structured && <button type="button" className="text-xs text-blue-700 underline" onClick={() => setCustom(!custom)}>{custom ? "Use guided controls" : "Use custom text instead"}</button>}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} /> I have verified this information</label>
    {existing && <p className="text-xs text-slate-500">Source: {data.sources.find(s => s.id === existing.source_id)?.name as string ?? "Not linked"} · Updated: {String(existing.updated_at ?? existing.created_at ?? "Not recorded").slice(0, 10)}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex justify-end gap-2"><button type="button" className={button} onClick={close}>Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">{busy ? "Saving…" : "Save changes"}</button></div>
  </fieldset></form></Modal>;
}
export function OfferingEditor({ template, data, offering, close, saved }: { template: BusinessTemplate; data: HubData; offering?: Row; close: () => void; saved: () => Promise<void> }) {
  const [id, setId] = useState(offering?.id);
  const [type, setType] = useState(String(offering?.offering_type ?? (template.id === "retail" ? "product" : template.id === "restaurant" ? "menu_item" : "service")));
  const [name, setName] = useState(String(offering?.name ?? ""));
  const [description, setDescription] = useState(String(offering?.description ?? ""));
  const [changes, setChanges] = useState<Record<string, FieldValue>>({});
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fields = offeringFields(template, type);
  return <Modal title={id ? "Edit product or service" : "Add product or service"} close={close} busy={busy}><form onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const values = Object.fromEntries(Object.entries(changes).filter(([key]) => fields.some(f => f.key === key)));
      const result = await saveGuidedOffering({ templateId: template.id, id, name, type, description, values, verified: checked });
      if (result.row) setId(result.row.id);
      if (result.error) { setError(result.error); if (result.row) await saved(); return; }
      await saved(); close();
    } catch { setError("Save could not be confirmed. Close and reload before retrying."); } finally { setBusy(false); }
  }}><fieldset disabled={busy} className="space-y-5">
    <label className="grid gap-2 text-sm font-semibold">What are you adding?<select className={inputStyle} value={type} onChange={e => setType(e.target.value)}><option value="product">Product</option><option value="service">Service</option><option value="menu_item">Menu item</option>{!["product", "service", "menu_item"].includes(type) && <option value={type}>{type}</option>}</select></label>
    <div className="space-y-4"><h3 className="font-semibold">Basic Information</h3><label className="grid gap-2 text-sm">{type === "menu_item" ? "Item" : type === "service" ? "Service" : "Product"} name<input required maxLength={200} className={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="What should customers call it?" /></label><label className="grid gap-2 text-sm">Description<textarea className={inputStyle} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what customers receive." /></label></div>
    {[...new Set(fields.map(f => f.section))].map(section => <details key={section} open={["Basic Information", "Pricing", "Availability"].includes(section)} className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer font-semibold">{section}</summary><div className="mt-4 space-y-5">{fields.filter(f => f.section === section).map(field => {
      const raw = offering ? readField(data.facts, field, data.business, offering.id) : undefined;
      const value = changes[field.key] ?? fieldValue(field, raw);
      return <div key={field.key}>{hasValue(raw) && <p className="mb-2 text-xs text-slate-500">Saved: {friendlyValue(raw)}</p>}<TypedInput field={field} value={value} onChange={v => setChanges(c => ({ ...c, [field.key]: v }))} /></div>;
    })}</div></details>)}
    <div className="space-y-2 border-t border-slate-100 pt-4"><h3 className="font-semibold">Verification</h3><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} /> I have verified the details changed in this form</label><p className="text-xs text-slate-500">Unchanged details keep their verification and sources. New details start as Needs Review unless you confirm them.</p></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex justify-end gap-2"><button type="button" className={button} onClick={close}>Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">{busy ? "Saving…" : "Save offering"}</button></div>
  </fieldset></form></Modal>;
}
