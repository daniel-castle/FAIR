import type { TruthFact } from "@/lib/queries/evaluation";
import { businessMentioned, normalizeIdentity } from "./identity";
import { compareFactValues, type VerifiedClaim } from "./verify";

const recommendationWords = /\b(recommend(?:ed)?|best|top|try|consider|good option|great option|strong option|worth visiting|choices?|options?)\b/i;
const currencyPattern = /(?:[$€£]\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s?(?:USD|EUR|GBP|dollars?|euros?|pounds?))/gi;
const timePattern = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/gi;
const booleanPattern = /\b(?:yes|no|available|unavailable|offered|not offered|included|not included)\b/gi;

function segments(response: string) {
  return response.split(/\n+|(?<=[.!?])\s+/).map(value => value.trim()).filter(Boolean);
}

function containsIdentity(value: string, identities: string[]) {
  const normalized = normalizeIdentity(value);
  return identities.some(identity => normalized.includes(identity));
}

function recommendationEvidence(response: string, aliases: string[]) {
  const lines = response.split(/\n+/).map(line => line.trim()).filter(Boolean);
  for (const line of lines) {
    const ordered = line.match(/^(\d{1,2})[.)]\s+(.+)/);
    if (ordered && containsIdentity(ordered[2], aliases)) {
      return { recommended: true, position: Number(ordered[1]) };
    }
  }
  for (const line of lines) {
    const bullet = line.match(/^[-*•]\s+(.+)/);
    if (bullet && containsIdentity(bullet[1], aliases)) {
      return { recommended: true, position: null };
    }
  }
  const sentence = segments(response).find(value => containsIdentity(value, aliases) && recommendationWords.test(value));
  return { recommended: !!sentence, position: null };
}

function factKind(factKey: string) {
  const normalized = normalizeIdentity(factKey);
  if (/price|cost|fee|rate/.test(normalized)) return "currency";
  if (/time|hour|open|close/.test(normalized)) return "time";
  if (/available|availability|emergency|financing|delivery|licensed|certified|warranty/.test(normalized)) return "boolean";
  return "text";
}

function relevantSegments(response: string, subject: string, businessAliases: string[]) {
  const subjectIdentity = normalizeIdentity(subject);
  const identities = subjectIdentity ? [subjectIdentity] : businessAliases;
  return segments(response).filter(segment => containsIdentity(segment, identities));
}

function extractedValues(kind: ReturnType<typeof factKind>, values: string[]) {
  const pattern = kind === "currency" ? currencyPattern : kind === "time" ? timePattern : kind === "boolean" ? booleanPattern : null;
  if (!pattern) return [];
  return values.flatMap(value => [...value.matchAll(new RegExp(pattern.source, pattern.flags))].map(match => match[0]));
}

function evaluateFact(response: string, fact: TruthFact, businessName: string, aliases: string[]): VerifiedClaim {
  const subject = fact.offering ?? businessName;
  const relevant = relevantSegments(response, subject, aliases);
  const evidence = relevant.join(" ").slice(0, 1500);
  const kind = factKind(fact.key);
  const values = extractedValues(kind, relevant);
  if (kind === "text") {
    const canonical = normalizeIdentity(fact.value);
    const match = relevant.find(segment => canonical.length >= 2 && normalizeIdentity(segment).includes(canonical));
    if (match) return { subject, offering: fact.offering, fact_key: fact.key, value: fact.value, evidence_text: match.slice(0, 1500), fact_id: fact.id, canonical_value_snapshot: fact.value, verification_status: "verified" };
  } else if (values.length) {
    const compared = values.map(value => ({ value, status: compareFactValues(value, fact.value) }));
    const verified = compared.find(item => item.status === "verified");
    if (verified) return { subject, offering: fact.offering, fact_key: fact.key, value: verified.value, evidence_text: evidence, fact_id: fact.id, canonical_value_snapshot: fact.value, verification_status: "verified" };
    const conflicts = compared.filter(item => item.status === "conflict");
    if (conflicts.length && new Set(conflicts.map(item => normalizeIdentity(item.value))).size === 1) {
      return { subject, offering: fact.offering, fact_key: fact.key, value: conflicts[0].value, evidence_text: evidence, fact_id: fact.id, canonical_value_snapshot: fact.value, verification_status: "conflict" };
    }
  }
  return { subject, offering: fact.offering, fact_key: fact.key, value: "No unambiguous value found", evidence_text: evidence || "No response passage could be matched confidently to this benchmark fact.", fact_id: fact.id, canonical_value_snapshot: fact.value, verification_status: "needs_review" };
}

export function evaluateMonitoredResponse(input: {
  rawResponse: string;
  businessName: string;
  aliases: string[];
  linkedFacts: TruthFact[];
  evaluateFacts: boolean;
}) {
  const mentioned = businessMentioned(input.rawResponse, [], input.aliases);
  const recommendation = mentioned ? recommendationEvidence(input.rawResponse, input.aliases) : { recommended: false, position: null };
  const claims = input.evaluateFacts ? input.linkedFacts.filter(fact => fact.verified).map(fact => evaluateFact(input.rawResponse, fact, input.businessName, input.aliases)) : [];
  return {
    mentioned,
    recommended: mentioned && recommendation.recommended,
    recommendation_position: mentioned ? recommendation.position : null,
    mentioned_businesses: mentioned ? [input.businessName] : [],
    claims,
  };
}
