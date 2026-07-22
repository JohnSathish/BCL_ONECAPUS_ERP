import 'server-only';

import type { DepartmentCard, DepartmentDetail, FacultyProfile } from '@/lib/academic-types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const safeTenant = () => {
  const value = process.env.COLLEGE_TENANT_SLUG ?? process.env.NEXT_PUBLIC_TENANT_SLUG;
  if (value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return value;
  // Local/dev default: Don Bosco College Tura demo tenant
  if (process.env.NODE_ENV !== 'production') return 'demo';
  return undefined;
};

const cmsBase = () => {
  const internal = process.env.API_INTERNAL_ORIGIN?.replace(/\/+$/, '');
  if (internal && /^https?:\/\/[^/]+$/i.test(internal)) return `${internal}/api`;
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.endsWith('/api') ? configured : `${configured}/api`;
  }
  // Local/dev default when env is missing
  if (process.env.NODE_ENV !== 'production') return 'http://127.0.0.1:3001/api';
  return undefined;
};

const academicUrl = (endpoint: string, query: Record<string, string> = {}) => {
  const base = cmsBase();
  if (!base) return undefined;
  const url = new URL(`${base}/v1/website/public/academic/${endpoint}`);
  const tenant = safeTenant();
  if (tenant) url.searchParams.set('tenant', tenant);
  Object.entries(query).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url;
};

const cmsHeaders = () => {
  const host = process.env.COLLEGE_CMS_HOST?.trim().toLowerCase();
  return host && /^[a-z0-9.-]+(?::\d+)?$/.test(host) ? { 'x-forwarded-host': host } : undefined;
};

async function fetchAcademic<T>(
  endpoint: string,
  query?: Record<string, string>,
  revalidate = 120,
): Promise<T | null> {
  const url = academicUrl(endpoint, query);
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: cmsHeaders(),
      next: { revalidate },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as unknown;
    if (isRecord(payload) && payload.success === true && 'data' in payload) {
      return payload.data as T;
    }
    return payload as T;
  } catch {
    return null;
  }
}

export async function listAcademicDepartments(options?: {
  q?: string;
  category?: string;
}): Promise<DepartmentCard[]> {
  const result = await fetchAcademic<{ items: DepartmentCard[]; total: number }>('departments', {
    ...(options?.q ? { q: options.q } : {}),
    ...(options?.category && options.category !== 'ALL' ? { category: options.category } : {}),
  });
  return result?.items ?? [];
}

export async function getAcademicDepartment(slug: string): Promise<DepartmentDetail | null> {
  return fetchAcademic<DepartmentDetail>(`departments/${encodeURIComponent(slug)}`);
}

export async function getAcademicFaculty(slug: string): Promise<FacultyProfile | null> {
  return fetchAcademic<FacultyProfile>(`faculty/${encodeURIComponent(slug)}`);
}

export async function searchAcademic(q: string) {
  return fetchAcademic<{
    departments: DepartmentCard[];
    faculty: unknown[];
    programmes: unknown[];
  }>('search', { q });
}
