import type { SchoolConfig, SchoolRegistryEntry } from '@/types/school';

const REGISTRY_URL =
  process.env.EXPO_PUBLIC_SCHOOL_REGISTRY_URL?.trim() ||
  'https://basecodelabs.com/onecampus-schools.json';

const DEV_FALLBACK: SchoolRegistryEntry[] = [
  {
    id: 'local-dev',
    name: 'Local development',
    apiUrl: 'http://localhost:3001/api',
    tenantSlug: 'demo',
    region: 'Dev',
    keywords: ['localhost', 'dev'],
  },
  {
    id: 'dbc-tura',
    name: 'Don Bosco College, Tura',
    apiUrl: 'https://erp.donboscocollege.ac.in/api',
    tenantSlug: 'demo',
    region: 'Meghalaya',
    keywords: ['don bosco', 'dbc', 'tura'],
  },
];

function parseRegistryJson(raw: unknown): SchoolRegistryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is SchoolRegistryEntry => {
      if (!row || typeof row !== 'object') return false;
      const r = row as SchoolRegistryEntry;
      return Boolean(r.id && r.name && r.apiUrl && r.tenantSlug);
    })
    .map((row) => ({
      ...row,
      apiUrl: row.apiUrl.trim().replace(/\/+$/, '').endsWith('/api')
        ? row.apiUrl.trim().replace(/\/+$/, '')
        : `${row.apiUrl.trim().replace(/\/+$/, '')}/api`,
      tenantSlug: row.tenantSlug.trim().toLowerCase(),
    }));
}

export async function fetchSchoolRegistry(): Promise<SchoolRegistryEntry[]> {
  const merged = new Map<string, SchoolRegistryEntry>();

  for (const row of DEV_FALLBACK) {
    merged.set(row.id, row);
  }

  const envJson = process.env.EXPO_PUBLIC_SCHOOL_REGISTRY_JSON?.trim();
  if (envJson) {
    try {
      for (const row of parseRegistryJson(JSON.parse(envJson))) {
        merged.set(row.id, row);
      }
    } catch {
      // ignore malformed env JSON
    }
  }

  try {
    const res = await fetch(REGISTRY_URL, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const json = await res.json();
      const remote = parseRegistryJson(json);
      for (const row of remote) {
        merged.set(row.id, row);
      }
    }
  } catch {
    // offline — use fallbacks only
  }

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function filterSchools(schools: SchoolRegistryEntry[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return schools;
  return schools.filter((s) => {
    const hay = [s.name, s.region, s.tenantSlug, ...(s.keywords ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export async function probeSchoolConnection(config: SchoolConfig): Promise<void> {
  const url = `${config.apiUrl.replace(/\/+$/, '')}/v1/mobile-app/bootstrap?appType=student`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Tenant-Slug': config.tenantSlug,
      'X-Client-Type': 'mobile',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      body.includes('tenant')
        ? 'Could not reach this institution. Check tenant code and API URL.'
        : `Server responded with ${res.status}. Check the API URL.`,
    );
  }
}

export function parseSchoolDeepLink(url: string): Partial<SchoolConfig> | null {
  try {
    const parsed = new URL(url);
    const api =
      parsed.searchParams.get('api') ||
      parsed.searchParams.get('apiUrl') ||
      parsed.searchParams.get('api_url');
    const tenant =
      parsed.searchParams.get('tenant') ||
      parsed.searchParams.get('tenantSlug') ||
      parsed.searchParams.get('slug');
    const name = parsed.searchParams.get('name') || undefined;
    if (!api || !tenant) return null;
    return {
      id: tenant,
      name: name || tenant,
      apiUrl: api,
      tenantSlug: tenant,
    };
  } catch {
    return null;
  }
}
