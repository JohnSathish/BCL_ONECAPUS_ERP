import { headers } from 'next/headers';
import { unwrapApiPayload } from '@/lib/http/api-envelope';

export { schoolWebPath } from './paths';

function schoolWebApiBase() {
  const explicit = process.env.API_INTERNAL_URL?.replace(/\/+$/, '');
  if (explicit) return explicit.endsWith('/api') ? explicit : `${explicit}/api`;
  const origin = (
    process.env.API_INTERNAL_ORIGIN ??
    process.env.API_DEV_ORIGIN ??
    process.env.NEXT_PRIVATE_API_ORIGIN ??
    'http://127.0.0.1:3001'
  ).replace(/\/+$/, '');
  return origin.endsWith('/api') ? origin : `${origin}/api`;
}

export type SchoolWebMenuItem = {
  id: string;
  parentId: string | null;
  label: string;
  href: string;
  sortOrder: number;
  visible: boolean;
};

export type SchoolWebBundle = {
  site: {
    displayName: string;
    shortName: string;
    motto: string;
    addressLine: string;
    city: string;
    district: string;
    state: string;
    pin: string;
    email: string | null;
    phone: string | null;
    primaryColor: string;
    accentColor: string;
    seoTitle: string | null;
    seoDescription: string | null;
    applyCtaUrl: string | null;
    studentPortalUrl: string | null;
    extrasJson: Record<string, unknown>;
  };
  menus: Array<{ location: string; items: SchoolWebMenuItem[] }>;
  homepage: Array<{
    key: string;
    enabled: boolean;
    sortOrder: number;
    payload: Record<string, unknown>;
  }>;
  notices: Array<{
    id: string;
    slug: string;
    title: string;
    category: string;
    body: string;
    featured: boolean;
    publishedAt: string | null;
  }>;
  pages: Array<{
    slug: string;
    title: string;
    seoTitle: string | null;
    seoDescription?: string | null;
    seoJson?: Record<string, unknown>;
    updatedAt?: string;
  }>;
  events: Array<{
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    venue: string | null;
    startsAt: string;
    endsAt: string | null;
  }>;
  albums: Array<{
    id: string;
    slug: string;
    title: string;
    description?: string | null;
    eventDate?: string | null;
    photoCount?: number;
    category?: { id: string; name: string; slug: string } | null;
    cover?: { original: string; card: string; thumb: string } | null;
    items: Array<{
      id: string;
      caption: string | null;
      asset?: { storageKey: string; alt: string | null };
    }>;
  }>;
  staff: Array<{ id: string; fullName: string; designation: string | null; bio: string | null }>;
  downloads: Array<{ id: string; title: string; category: string }>;
};

export type SchoolWebPage = {
  slug: string;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoJson?: Record<string, unknown>;
  blockDocument: { blocks?: Array<{ type?: string; text?: string }> };
  updatedAt?: string;
};

export async function schoolWebRequestHost() {
  const h = await headers();
  return h.get('x-forwarded-host') || h.get('host') || 'school.localhost';
}

async function schoolWebGet<T>(path: string): Promise<T | null> {
  const host = await schoolWebRequestHost();
  try {
    const res = await fetch(`${schoolWebApiBase()}${path}`, {
      headers: {
        'X-Login-Host': host,
        'X-Forwarded-Host': host,
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(`[school-web] ${path} failed for host ${host}: HTTP ${res.status}`);
      return null;
    }
    return unwrapApiPayload<T>(await res.json());
  } catch (error) {
    console.error(`[school-web] ${path} failed`, error);
    return null;
  }
}

export async function fetchSchoolWebBundle(): Promise<SchoolWebBundle | null> {
  return schoolWebGet<SchoolWebBundle>('/v1/school-web/public/site');
}

export async function fetchSchoolWebPage(slug: string): Promise<SchoolWebPage | null> {
  return schoolWebGet<SchoolWebPage>(`/v1/school-web/public/pages/${encodeURIComponent(slug)}`);
}

export async function fetchSchoolWebNotice(slug: string) {
  return schoolWebGet<{
    slug: string;
    title: string;
    body: string;
    category: string;
    publishedAt: string | null;
    updatedAt?: string;
    seoJson?: Record<string, unknown>;
  }>(`/v1/school-web/public/notices/${encodeURIComponent(slug)}`);
}

export async function fetchSchoolWebEvent(slug: string) {
  return schoolWebGet<{
    slug: string;
    title: string;
    summary: string | null;
    venue: string | null;
    startsAt: string;
    endsAt: string | null;
    seoJson?: Record<string, unknown>;
  }>(`/v1/school-web/public/events/${encodeURIComponent(slug)}`);
}

export type SchoolWebPublicGallery = {
  page: number;
  total: number;
  pageSize: number;
  categories: Array<{ id: string; name: string; slug: string }>;
  tags: Array<{ id: string; name: string; slug: string }>;
  albums: Array<{
    id: string;
    slug: string;
    title: string;
    description: string | null;
    eventName: string | null;
    eventDate: string | null;
    location: string | null;
    photoCount: number;
    category: { id: string; name: string; slug: string } | null;
    tags: Array<{ id: string; name: string; slug: string }>;
    cover: { original: string; card: string; thumb: string } | null;
  }>;
};

export type SchoolWebPublicAlbum = SchoolWebPublicGallery['albums'][number] & {
  allowDownload: boolean;
  seo: Record<string, unknown>;
  items: Array<{
    id: string;
    title: string | null;
    caption: string | null;
    description: string | null;
    altText: string | null;
    credit: string | null;
    urls: { original: string; card: string; thumb: string };
  }>;
};

export async function fetchSchoolWebGallery(params?: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return schoolWebGet<SchoolWebPublicGallery>(`/v1/school-web/public/gallery${qs ? `?${qs}` : ''}`);
}

export async function fetchSchoolWebAlbum(slug: string) {
  return schoolWebGet<SchoolWebPublicAlbum>(
    `/v1/school-web/public/gallery/${encodeURIComponent(slug)}`,
  );
}

export function sectionPayload(bundle: SchoolWebBundle, key: string) {
  return bundle.homepage.find((s) => s.key === key)?.payload ?? {};
}

export function mainMenu(bundle: SchoolWebBundle) {
  return bundle.menus.find((m) => m.location === 'MAIN')?.items ?? [];
}

export function footerMenu(bundle: SchoolWebBundle) {
  return bundle.menus.find((m) => m.location === 'FOOTER')?.items ?? [];
}

export function extras(bundle: SchoolWebBundle) {
  return bundle.site.extrasJson ?? {};
}

export function pageParagraphs(page: SchoolWebPage) {
  return (page.blockDocument?.blocks ?? [])
    .map((b) => b.text?.trim())
    .filter((t): t is string => Boolean(t));
}
