/** Host helpers for public journal portals (Transient, Source, …). */

const RESERVED_JOURNAL_LABELS = new Set([
  'www',
  'erp',
  'api',
  'alumni',
  'admissions',
  'career',
  'careers',
  'library',
  'pay',
  'demo',
  'app',
  'portal',
  'admin',
  'mail',
  'server',
  'journals',
  'localhost',
]);

export function extractJournalSlugFromHost(host: string): string | null {
  const hostname = host.split(':')[0]?.toLowerCase() ?? '';
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length < 2) return null;
  const slug = parts[0];
  if (!slug || RESERVED_JOURNAL_LABELS.has(slug)) return null;
  return slug;
}

export function isJournalHost(host: string): boolean {
  return Boolean(extractJournalSlugFromHost(host));
}

export function getJournalSlugFromLocation(): string | null {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_JOURNAL_SLUG ?? 'transient';
  }
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('journal')?.trim().toLowerCase();
  if (fromQuery) return fromQuery;
  const fromHost = extractJournalSlugFromHost(window.location.host);
  if (fromHost) return fromHost;
  return process.env.NEXT_PUBLIC_JOURNAL_SLUG ?? 'transient';
}

export function getJournalsHostHeader(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_JOURNALS_HOST ?? 'transient.demo.localhost';
  }
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const slug = getJournalSlugFromLocation() || 'transient';
    return process.env.NEXT_PUBLIC_JOURNALS_HOST ?? `${slug}.demo.localhost`;
  }
  return window.location.host.includes(':')
    ? window.location.host.split(':')[0]!
    : window.location.hostname;
}

export function getJournalsRequestHeaders(): Record<string, string> {
  const host = getJournalsHostHeader();
  const slug = getJournalSlugFromLocation();
  return {
    'X-Forwarded-Host': host,
    'X-Login-Host': host,
    ...(slug ? { 'X-Journal-Slug': slug } : {}),
  };
}

export const JOURNALS_PUBLIC_URL =
  process.env.NEXT_PUBLIC_JOURNALS_URL ?? 'https://transient.donboscocollege.ac.in';
