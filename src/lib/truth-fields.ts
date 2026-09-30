import type { TemplateField } from "../data/business-templates";
import type { Row } from "./truth-hub";

export const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type DayHours = { state: "unset" | "open" | "closed"; open: string; close: string };
export type WeeklyHours = { kind: "weekly_hours"; days: Record<string, DayHours> };
export type Price = { kind: "pricing"; currency: "USD"; mode: string; amount: string; maximum: string };
export type Location = { kind: "location"; street: string; city: string; region: string; postal_code: string };
export type ServiceArea = { kind: "service_area"; places: string[]; radius: string; unit: string };
export type FieldValue = string | boolean | string[] | WeeklyHours | Price | Location | ServiceArea;
export function decodeFact(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}
export function objectValue(value: unknown): Record<string, unknown> | null {
  const decoded = decodeFact(value);
  return decoded && typeof decoded === "object" && !Array.isArray(decoded) ? decoded as Record<string, unknown> : null;
}
export function emptyHours(): WeeklyHours { return { kind: "weekly_hours", days: Object.fromEntries(weekdays.map(day => [day, { state: "unset", open: "", close: "" }])) }; }
export function fieldValue(field: TemplateField, raw: unknown): FieldValue {
  const value = decodeFact(raw);
  if (value == null) return "";
  if (field.type === "boolean") {
    if (typeof value === "boolean") return value;
    if (/^(yes|true|available)$/i.test(String(value))) return true;
    if (/^(no|false|unavailable)$/i.test(String(value))) return false;
  }
  if (["tags", "list", "multi-select"].includes(field.type)) return Array.isArray(value) ? value.map(String) : String(value).split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  if (field.type === "currency" && /^\$?\d+(\.\d{1,2})?$/.test(String(value))) return { kind: "pricing", currency: "USD", mode: "fixed", amount: String(value).replace("$", ""), maximum: "" };
  return value as FieldValue;
}
export function findFact(facts: Row[], field: TemplateField, offeringId?: string) {
  const scoped = facts.filter(f => offeringId ? f.offering_id === offeringId : !f.offering_id);
  return scoped.find(f => f.fact_key === field.key) ?? scoped.find(f => field.aliases?.includes(String(f.fact_key)));
}
export function readField(facts: Row[], field: TemplateField, business: Row | null, offeringId?: string) {
  const fact = findFact(facts, field, offeringId);
  return fact?.fact_value ?? (!offeringId ? business?.[field.key] : undefined);
}
export function hasValue(value: unknown): boolean {
  const v = decodeFact(value);
  if (v == null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  const obj = objectValue(v);
  if (obj?.kind === "weekly_hours") {
    const days = (obj as unknown as WeeklyHours).days;
    return weekdays.every(day => days[day]?.state === "closed" || (days[day]?.state === "open" && !!days[day].open && !!days[day].close));
  }
  if (obj?.kind === "location") return !!(obj.city || obj.street);
  if (obj?.kind === "service_area") return (obj.places as string[])?.length > 0 || !!obj.radius;
  if (obj?.kind === "pricing") return !!obj.mode && (["quote", "free"].includes(String(obj.mode)) || !!obj.amount);
  return true;
}
export function friendlyValue(value: unknown): string {
  const v = decodeFact(value);
  if (v == null || v === "") return "Not provided";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.join(", ") || "Not provided";
  const obj = objectValue(v);
  if (!obj) return String(v);
  if (obj.kind === "weekly_hours") return weekdays.map(day => {
    const d = (obj as unknown as WeeklyHours).days[day];
    return `${day.slice(0, 3)}: ${d?.state === "closed" ? "Closed" : d?.state === "open" ? `${d.open}–${d.close}${d.close <= d.open ? " (+1 day)" : ""}` : "Not set"}`;
  }).join(" · ");
  if (obj.kind === "pricing") return obj.mode === "free" ? "Free" : obj.mode === "quote" ? "Quote required" : `${obj.mode === "starting" ? "Starting at " : ""}$${obj.amount}${obj.mode === "range" ? `–$${obj.maximum}` : ""} USD`;
  if (obj.kind === "location") return [obj.street, obj.city, obj.region, obj.postal_code].filter(Boolean).join(", ");
  if (obj.kind === "service_area") return [...(obj.places as string[]), obj.radius ? `Within ${obj.radius} ${obj.unit}` : ""].filter(Boolean).join(" · ");
  return Object.entries(obj).map(([key, val]) => `${key.replaceAll("_", " ")}: ${friendlyValue(val)}`).join(" · ");
}
// Complex controls stay in fact_value as JSON text, compatible with both text and jsonb columns.
export function normalizeField(field: TemplateField, input: unknown): string {
  const v = fieldValue(field, input);
  const object = objectValue(v);
  if (field.type === "boolean") {
    if (typeof v !== "boolean") throw new Error(`${field.label}: choose Yes or No.`);
  } else if (field.type === "hours") {
    if (object?.kind !== "weekly_hours") throw new Error(`${field.label}: use the weekly editor or the custom text option.`);
    const h = v as WeeklyHours;
    for (const day of weekdays) {
      const d = h.days?.[day];
      if (!d || !["open", "closed", "unset"].includes(d.state)) throw new Error(`${day}: choose open or closed.`);
      if (d.state === "open" && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.close) || d.open === d.close)) throw new Error(`${day}: enter different opening and closing times.`);
      if (d.state !== "open") { d.open = ""; d.close = ""; }
    }
    if (!weekdays.some(day => h.days[day].state !== "unset")) throw new Error("Set at least one day’s hours.");
  } else if (field.type === "currency") {
    const p = v as Price;
    if (object?.kind !== "pricing" || !["fixed", "starting", "range", "quote", "free"].includes(p.mode) || p.currency !== "USD") throw new Error("Choose a pricing type.");
    if (!["quote", "free"].includes(p.mode) && (!/^\d+(\.\d{1,2})?$/.test(p.amount) || Number(p.amount) < 0)) throw new Error("Enter a valid price with at most two decimal places.");
    if (p.mode === "range" && (!/^\d+(\.\d{1,2})?$/.test(p.maximum) || Number(p.maximum) < Number(p.amount))) throw new Error("The maximum price must be at least the minimum price.");
    if (["quote", "free"].includes(p.mode)) p.amount = "";
    if (p.mode !== "range") p.maximum = "";
  } else if (["tags", "list", "multi-select"].includes(field.type)) {
    if (!Array.isArray(v)) throw new Error(`${field.label}: add items.`);
    const list = [...new Set(v.map(s => s.trim()).filter(Boolean))];
    if (list.length > 50 || list.some(s => s.length > 200)) throw new Error("Use up to 50 short items.");
    return JSON.stringify(list);
  } else if (field.type === "location") {
    if (object?.kind !== "location" || !hasValue(v)) throw new Error("Enter a city or street address.");
  } else if (field.type === "service-area") {
    const a = v as ServiceArea;
    if (object?.kind !== "service_area" || !Array.isArray(a.places) || !hasValue(a)) throw new Error("Add at least one place or a radius.");
    if (a.radius && (!Number.isFinite(Number(a.radius)) || Number(a.radius) <= 0)) throw new Error("Radius must be greater than zero.");
  } else {
    const text = String(v).trim();
    if (text.length > 5000 || !text) throw new Error(`${field.label}: enter a value.`);
    if (["number", "percentage", "duration"].includes(field.type) && (!Number.isFinite(Number(text)) || Number(text) < 0 || (field.type === "percentage" && Number(text) > 100))) throw new Error(`${field.label}: enter a valid non-negative number${field.type === "percentage" ? " up to 100" : ""}.`);
    if (field.type === "url" && !/^https?:\/\/[^\s]+$/i.test(text)) throw new Error("Use a full http or https website address.");
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new Error("Enter a valid email address.");
    if (field.type === "select" && !field.options?.includes(text)) throw new Error(`${field.label}: choose an option.`);
    return text;
  }
  return typeof v === "object" || typeof v === "boolean" ? JSON.stringify(v) : String(v).trim();
}
