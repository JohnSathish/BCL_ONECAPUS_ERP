export function licenseDomainAllowed(
  restriction: string | null | undefined,
  candidates: Array<string | null | undefined>,
) {
  const allowedList = String(restriction ?? '')
    .split(/[,;\s]+/)
    .map(normalizeHost)
    .filter(Boolean);
  if (!allowedList.length) return true;
  const got = candidates
    .map((c) => (c ? normalizeHost(c) : ''))
    .filter(Boolean);
  if (!got.length) return false;
  return allowedList.some((allowed) =>
    got.some((g) => hostMatches(allowed, g)),
  );
}

function normalizeHost(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .replace(/\.$/, '');
}

const ST_LUKES_ALIASES = new Set([
  'st-lukes-tura',
  'stlukestura.in',
  'erp.stlukestura.in',
  'sls.localhost',
]);

function aliasSet(host: string) {
  if (ST_LUKES_ALIASES.has(host)) return ST_LUKES_ALIASES;
  return new Set([host]);
}

function hostMatches(allowed: string, got: string) {
  if (!allowed || !got) return false;
  if (allowed === got) return true;
  if (aliasSet(allowed).has(got)) return true;
  if (got.endsWith(`.${allowed}`) || allowed.endsWith(`.${got}`)) return true;
  return false;
}
