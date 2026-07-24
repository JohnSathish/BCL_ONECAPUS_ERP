import 'server-only';

import { cmsBase, cmsHeaders, isRecord, safeTenant } from '@/lib/cms-client';
import type { DepartmentCard, DepartmentDetail, FacultyProfile } from '@/lib/academic-types';

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

async function fetchAcademic<T>(
  endpoint: string,
  query?: Record<string, string>,
  revalidate = 120,
): Promise<T | null> {
  const url = academicUrl(endpoint, query);
  if (!url) {
    console.warn(`[college-web] academic/${endpoint} skipped — no API base URL`);
    return null;
  }
  try {
    const response = await fetch(url, {
      headers: cmsHeaders(),
      ...(process.env.NODE_ENV !== 'production'
        ? { cache: 'no-store' as const }
        : { next: { revalidate, tags: ['website-cms', 'website-departments'] } }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      console.warn(
        `[college-web] academic/${endpoint} responded ${response.status} (${url.origin})`,
      );
      return null;
    }
    const payload = (await response.json()) as unknown;
    if (isRecord(payload) && payload.success === true && 'data' in payload) {
      return payload.data as T;
    }
    return payload as T;
  } catch (error) {
    console.warn(`[college-web] academic/${endpoint} unavailable`, error);
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
