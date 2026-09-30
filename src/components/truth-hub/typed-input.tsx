"use client";
import { useId, useState } from "react";
import type { TemplateField } from "@/data/business-templates";
import { emptyHours, objectValue, weekdays, type FieldValue, type WeeklyHours, type Price, type Location, type ServiceArea } from "@/lib/truth-fields";
export const inputStyle = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-blue-600 disabled:bg-slate-50 disabled:text-slate-400";
const smallButton = "rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50";
function Tags({ value, onChange, label }: { value: string[]; onChange: (value: string[]) => void; label: string }) {
  const [draft, setDraft] = useState("");
  function add() { const item = draft.trim(); if (item) { onChange([...new Set([...value, item])]); setDraft(""); } }
  return <div><div className="mb-2 flex flex-wrap gap-2">{value.map(item => <span key={item} className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-800">{item}<button type="button" aria-label={`Remove ${item}`} onClick={() => onChange(value.filter(v => v !== item))}>×</button></span>)}</div><div className="flex gap-2"><input className={inputStyle} aria-label={`Add ${label}`} maxLength={200} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Type an item" /><button className={smallButton} type="button" onClick={add}>Add item</button></div></div>;
}
export function TypedInput({ field, value, onChange }: { field: TemplateField; value: FieldValue; onChange: (value: FieldValue) => void }) {
  const id = useId();
  const obj = objectValue(value);
  const common = { id, className: inputStyle, required: field.required, "aria-label": field.label, "aria-describedby": `${id}-help` };
  let input;
  if (field.type === "hours") {
    const hours: WeeklyHours = obj?.kind === "weekly_hours" ? value as WeeklyHours : emptyHours();
    input = <div className="space-y-2"><button type="button" className={smallButton} onClick={() => onChange({ ...hours, days: { ...hours.days, ...Object.fromEntries(weekdays.slice(1, 5).map(day => [day, { ...hours.days.Monday }])) } })}>Copy Monday to weekdays</button>{weekdays.map(day => {
      const d = hours.days[day] ?? { state: "unset", open: "", close: "" };
      const change = (patch: Partial<typeof d>) => onChange({ ...hours, days: { ...hours.days, [day]: { ...d, ...patch } } });
      return <div key={day} className="grid grid-cols-2 items-center gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-[90px_110px_1fr_1fr]"><span className="text-sm font-medium">{day}</span><select className={inputStyle} aria-label={`${day} status`} value={d.state} onChange={e => change({ state: e.target.value as typeof d.state })}><option value="unset">Not set</option><option value="open">Open</option><option value="closed">Closed</option></select><label className="text-xs text-slate-500">Open<input type="time" className={inputStyle} aria-label={`${day} opening time`} required={d.state === "open"} disabled={d.state !== "open"} value={d.open} onChange={e => change({ open: e.target.value })} /></label><label className="text-xs text-slate-500">Close<input type="time" className={inputStyle} aria-label={`${day} closing time`} required={d.state === "open"} disabled={d.state !== "open"} value={d.close} onChange={e => change({ close: e.target.value })} /></label>{d.state === "open" && d.close && d.open && d.close < d.open && <p className="col-span-full text-xs text-blue-700">Closes the following day.</p>}</div>;
    })}</div>;
  } else if (field.type === "currency") {
    const p: Price = obj?.kind === "pricing" ? value as Price : { kind: "pricing", currency: "USD", mode: "", amount: "", maximum: "" };
    input = <div className="space-y-3"><select {...common} aria-label={`${field.label} pricing type`} value={p.mode} onChange={e => onChange({ ...p, mode: e.target.value })}><option value="">Choose pricing type</option>{[["fixed", "Fixed price"], ["starting", "Starting at"], ["range", "Price range"], ["quote", "Quote required"], ["free", "Free"]].map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select>{p.mode && !["quote", "free"].includes(p.mode) && <div className="flex items-center gap-2"><span>$</span><input aria-label={`${field.label} amount`} className={inputStyle} type="number" min="0" step="0.01" required value={p.amount} onChange={e => onChange({ ...p, amount: e.target.value })} placeholder="14.99" />{p.mode === "range" && <><span>to $</span><input aria-label={`${field.label} maximum`} className={inputStyle} type="number" min={p.amount || "0"} step="0.01" required value={p.maximum} onChange={e => onChange({ ...p, maximum: e.target.value })} /></>}<span className="text-xs text-slate-500">USD{field.unit ? ` / ${field.unit}` : ""}</span></div>}</div>;
  } else if (field.type === "boolean") {
    input = <div role="group" aria-label={field.label} className="flex gap-2">{[true, false].map(v => <button key={String(v)} type="button" aria-pressed={value === v} className={`rounded-lg border px-5 py-2 text-sm ${value === v ? "border-blue-600 bg-blue-50 font-semibold text-blue-700" : "border-slate-200 text-slate-600"}`} onClick={() => onChange(v)}>{v ? "Yes" : "No"}</button>)}</div>;
  } else if (["tags", "list"].includes(field.type)) {
    input = <Tags value={Array.isArray(value) ? value : []} onChange={onChange} label={field.label} />;
  } else if (field.type === "multi-select") {
    const values = Array.isArray(value) ? value : [];
    input = <div className="flex flex-wrap gap-2">{[...new Set([...(field.options ?? []), ...values])].map(option => <label key={option} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={values.includes(option)} onChange={e => onChange(e.target.checked ? [...values, option] : values.filter(v => v !== option))} />{option}</label>)}</div>;
  } else if (field.type === "location") {
    const a: Location = obj?.kind === "location" ? value as Location : { kind: "location", street: "", city: "", region: "", postal_code: "" };
    input = <div className="grid gap-3 sm:grid-cols-2">{[["street", "Street address"], ["city", "City"], ["region", "State / Region"], ["postal_code", "ZIP / Postal code"]].map(([key, label]) => <label key={key} className="grid gap-1 text-xs text-slate-500">{label}<input className={inputStyle} value={a[key as keyof Location]} onChange={e => onChange({ ...a, [key]: e.target.value })} /></label>)}</div>;
  } else if (field.type === "service-area") {
    const a: ServiceArea = obj?.kind === "service_area" ? value as ServiceArea : { kind: "service_area", places: typeof value === "string" && value ? value.split(",").map(s => s.trim()) : [], radius: "", unit: "miles" };
    input = <div className="space-y-3"><Tags value={a.places} label="city, ZIP code, or region" onChange={places => onChange({ ...a, places })} /><div className="flex items-end gap-2"><label className="grid gap-1 text-xs text-slate-500">Radius (optional)<input className={inputStyle} type="number" min="0.1" step="any" value={a.radius} onChange={e => onChange({ ...a, radius: e.target.value })} /></label><select aria-label="Radius unit" className={inputStyle} value={a.unit} onChange={e => onChange({ ...a, unit: e.target.value })}><option>miles</option><option>km</option></select></div></div>;
  } else if (field.type === "select") {
    input = <select {...common} value={String(value)} onChange={e => onChange(e.target.value)}><option value="">Choose an option</option>{[...new Set([...(field.options ?? []), ...(value ? [String(value)] : [])])].map(option => <option key={option}>{option}</option>)}</select>;
  } else if (field.type === "textarea") {
    input = <textarea {...common} rows={3} value={String(value)} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} />;
  } else {
    const type = ({ currency: "number", percentage: "number", duration: "number", phone: "tel" } as Record<string, string>)[field.type] ?? field.type;
    input = <div className="flex items-center gap-2"><input {...common} type={type} min={["number", "percentage", "duration"].includes(field.type) ? 0 : undefined} max={field.type === "percentage" ? 100 : undefined} step="any" value={String(value)} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} />{field.unit && <span className="text-xs text-slate-500">{field.unit}</span>}</div>;
  }
  return <fieldset className="min-w-0 space-y-2"><legend className="mb-2 text-sm font-semibold text-slate-800">{field.label}{field.required ? " *" : ""}</legend>{input}{field.help && <p id={`${id}-help`} className="text-xs leading-5 text-slate-500">{field.help}</p>}</fieldset>;
}
