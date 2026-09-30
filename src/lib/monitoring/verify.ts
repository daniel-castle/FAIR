import type { VerificationStatus } from "./schema";

export type VerifiedClaim = {
  subject: string;
  offering: string | null;
  fact_key: string | null;
  value: string;
  evidence_text: string;
  fact_id: string | null;
  canonical_value_snapshot: string | null;
  verification_status: VerificationStatus;
};

function plain(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim();
}

function money(value: string) {
  if (!/[$€£]|\b(?:usd|eur|gbp|dollars?|euros?|pounds?)\b/i.test(value)) return null;
  const match = value.replaceAll(",", "").match(/-?\d+(?:\.\d{1,2})?/);
  return match ? Number(match[0]).toFixed(2) : null;
}

function booleanValue(value: string) {
  const normalized = plain(value);
  if (/^(yes|true|available|offered|included)$/.test(normalized)) return true;
  if (/^(no|false|unavailable|not offered|not included)$/.test(normalized)) return false;
  return null;
}

function timeValue(value: string) {
  const match = plain(value).match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3] === "pm") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2] ?? "00"}`;
}

export function compareFactValues(observed: string, canonical: string): VerificationStatus {
  if (plain(observed) === plain(canonical)) return "verified";
  const observedMoney = money(observed); const canonicalMoney = money(canonical);
  if (observedMoney && canonicalMoney) return observedMoney === canonicalMoney ? "verified" : "conflict";
  const observedTime = timeValue(observed); const canonicalTime = timeValue(canonical);
  if (observedTime && canonicalTime) return observedTime === canonicalTime ? "verified" : "conflict";
  const observedBoolean = booleanValue(observed); const canonicalBoolean = booleanValue(canonical);
  if (observedBoolean !== null && canonicalBoolean !== null) return observedBoolean === canonicalBoolean ? "verified" : "conflict";
  if (!/[{}[\]]/.test(observed + canonical) && observed.length <= 120 && canonical.length <= 120) return "conflict";
  return "needs_review";
}
