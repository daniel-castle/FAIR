export type Row = { id: string; [key: string]: unknown };
export type HubData = { business: Row | null; offerings: Row[]; facts: Row[]; sources: Row[]; errors: string[] };
export function display(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
export function verified(row: Row) { return row.verified === true; }
