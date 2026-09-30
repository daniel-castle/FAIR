export function normalizeIdentity(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function identityAliases(name: string, aliases: string[] = []) {
  return [...new Set([name, ...aliases].map(normalizeIdentity).filter(value => value.length >= 2))];
}

export function matchesBusinessIdentity(reference: string, aliases: string[]) {
  const normalized = normalizeIdentity(reference);
  return aliases.some(alias => {
    if (normalized === alias) return true;
    const shorter = Math.min(normalized.length, alias.length);
    const longer = Math.max(normalized.length, alias.length);
    return shorter >= 6 && shorter / longer >= 0.7 && (normalized.includes(alias) || alias.includes(normalized));
  });
}

export function businessMentioned(rawResponse: string, mentionedBusinesses: string[], aliases: string[]) {
  if (mentionedBusinesses.some(reference => matchesBusinessIdentity(reference, aliases))) return true;
  const normalizedResponse = ` ${normalizeIdentity(rawResponse)} `;
  return aliases.some(alias => alias.length >= 4 && normalizedResponse.includes(` ${alias} `));
}
