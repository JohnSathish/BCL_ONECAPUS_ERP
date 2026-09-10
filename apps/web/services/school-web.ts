import { api } from './api';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { pingActivity } from '@/lib/auth/session-activity';
import { createHttpClient } from '@/lib/http/create-client';
import { getDirectApiBaseUrl } from '@/lib/http/env';

const galleryUploadApi = createHttpClient({
  baseURL: getDirectApiBaseUrl(),
  onSuccess: pingActivity,
  onUnauthorized: (error, retry) => tokenRefreshManager.handle401(error, retry),
});

export async function fetchSchoolWebSite() {
  const { data } = await api.get('/v1/school-web/site');
  return data as {
    displayName: string;
    motto: string;
    addressLine: string;
    city: string;
    pin: string;
    email: string | null;
    phone: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    applyCtaUrl: string | null;
    studentPortalUrl: string | null;
    extrasJson: Record<string, unknown>;
  };
}

export async function patchSchoolWebSite(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/school-web/site', payload);
  return data;
}

export async function fetchSchoolWebHomepage() {
  const { data } = await api.get('/v1/school-web/homepage');
  return data as Array<{
    key: string;
    enabled: boolean;
    sortOrder: number;
    payload: Record<string, unknown>;
  }>;
}

export async function patchSchoolWebHomepage(key: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/school-web/homepage/${key}`, payload);
  return data;
}

export const SCHOOL_WEB_HERO_SLIDE_MAX = 15;

export async function uploadSchoolWebHeroImages(files: File[]) {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  const { data } = await galleryUploadApi.post('/v1/school-web/homepage/hero/images', form, {
    timeout: 180_000,
  });
  return data as { urls: string[]; maxSlides: number };
}

export async function fetchSchoolWebPages() {
  const { data } = await api.get('/v1/school-web/pages');
  return data as Array<{
    slug: string;
    title: string;
    status: string;
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoJson?: Record<string, unknown>;
    blockDocument?: { blocks?: Array<{ text?: string }> };
  }>;
}

export async function upsertSchoolWebPage(payload: {
  slug: string;
  title: string;
  status?: string;
  blockDocument?: Record<string, unknown>;
  seoTitle?: string;
  seoDescription?: string;
  seoJson?: Record<string, unknown>;
}) {
  const { data } = await api.post('/v1/school-web/pages', payload);
  return data;
}

export async function fetchSchoolWebNoticesOffice() {
  const { data } = await api.get('/v1/school-web/notices');
  return data as Array<{
    slug: string;
    title: string;
    status: string;
    category: string;
    body: string;
    seoJson?: Record<string, unknown>;
  }>;
}

export async function upsertSchoolWebNotice(payload: {
  slug: string;
  title: string;
  body: string;
  category?: string;
  status?: string;
  featured?: boolean;
}) {
  const { data } = await api.post('/v1/school-web/notices', payload);
  return data;
}

export async function fetchSchoolWebEventsOffice() {
  const { data } = await api.get('/v1/school-web/events');
  return data as Array<{
    slug: string;
    title: string;
    startsAt: string;
    status: string;
    venue: string | null;
  }>;
}

export async function upsertSchoolWebEvent(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-web/events', payload);
  return data;
}

export async function fetchSchoolWebMenus() {
  const { data } = await api.get('/v1/school-web/menus');
  return data as Array<{
    location: string;
    items: Array<{ label: string; href: string; parentId: string | null }>;
  }>;
}

export async function fetchSchoolWebSeoAudit() {
  const { data } = await api.get('/v1/school-web/seo/audit');
  return data as {
    indexed: number;
    published: number;
    noindex: number;
    missingTitles: number;
    missingDescriptions: number;
    homeTitle: boolean;
    homeDescription: boolean;
    publicBaseUrl: string;
    googleVerification: boolean;
    sitemapPath: string;
    robotsPath: string;
    audit?: Array<{
      id: string;
      status: 'pass' | 'warning' | 'error';
      label: string;
      hint?: string;
    }>;
    items: Array<{
      kind: string;
      path: string;
      title: string;
      status: string;
      indexable: boolean;
      warnings: string[];
    }>;
  };
}

export async function fetchSchoolWebVisitorStats() {
  const { data } = await api.get('/v1/school-web/visitors/stats');
  return data as {
    currentlyOnline: number;
    visitorsToday: number;
    uniqueVisitorsToday: number;
    pageViewsToday: number;
    visitorsThisWeek: number;
    uniqueVisitorsThisWeek: number;
    pageViewsThisWeek: number;
    visitorsThisMonth: number;
    uniqueVisitorsThisMonth: number;
    pageViewsThisMonth: number;
    totalVisitors: number;
    mostVisitedPages: Array<{ path: string; views: number }>;
    trend: Array<{ day: string; visits: number; uniqueVisitors: number; pageViews: number }>;
  };
}

export async function fetchSchoolWebEnquiries() {
  const { data } = await api.get('/v1/school-web/enquiries');
  return data as Array<{
    id: string;
    name: string;
    email: string | null;
    message: string;
    status: string;
    createdAt: string;
  }>;
}

export type SchoolWebGalleryUrls = { original: string; card: string; thumb: string };

export type SchoolWebGalleryAlbum = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  eventName: string | null;
  eventDate: string | null;
  location: string | null;
  status: string;
  visibility: string;
  allowDownload: boolean;
  academicYear?: string | null;
  scheduledAt?: string | null;
  sortOrder: number;
  viewCount?: number;
  photoCount?: number;
  category: { id: string; name: string; slug: string } | null;
  tags?: Array<{ id: string; name: string; slug: string }>;
  cover: SchoolWebGalleryUrls | null;
  items?: Array<{
    id: string;
    title: string | null;
    caption: string | null;
    description: string | null;
    altText: string | null;
    credit: string | null;
    sortOrder: number;
    assetId?: string;
    urls: SchoolWebGalleryUrls;
  }>;
};

export async function fetchSchoolWebGalleryDashboard() {
  const { data } = await api.get('/v1/school-web/gallery/dashboard');
  return data as {
    total: number;
    published: number;
    draft: number;
    archived: number;
    unpublished: number;
    images: number;
    storageBytes: number;
    recentAlbums: SchoolWebGalleryAlbum[];
    recentImages: Array<{
      id: string;
      albumId: string;
      albumTitle: string;
      createdAt: string;
      urls: SchoolWebGalleryUrls;
    }>;
  };
}

export async function fetchSchoolWebGalleryAlbums(params?: Record<string, string>) {
  const { data } = await api.get('/v1/school-web/gallery', { params });
  return data as SchoolWebGalleryAlbum[];
}

export async function fetchSchoolWebGalleryAlbum(id: string, page = 1) {
  const { data } = await api.get(`/v1/school-web/gallery/${id}`, { params: { page } });
  return data as SchoolWebGalleryAlbum & { page: number; pageSize: number; photoCount: number };
}

export async function upsertSchoolWebGalleryAlbum(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`/v1/school-web/gallery/${id}`, payload)
    : await api.post('/v1/school-web/gallery', payload);
  return data as SchoolWebGalleryAlbum;
}

export async function bulkSchoolWebGalleryAlbums(payload: {
  ids: string[];
  action: string;
  categoryId?: string;
  visibility?: string;
}) {
  const { data } = await api.post('/v1/school-web/gallery/bulk', payload);
  return data as { ok: boolean };
}

export async function fetchSchoolWebGalleryCategories() {
  const { data } = await api.get('/v1/school-web/gallery/categories');
  return data as Array<{ id: string; name: string; slug: string; sortOrder: number }>;
}

export async function upsertSchoolWebGalleryCategory(payload: {
  id?: string;
  name: string;
  slug?: string;
  sortOrder?: number;
}) {
  const { data } = await api.post('/v1/school-web/gallery/categories', payload);
  return data;
}

export async function deleteSchoolWebGalleryCategory(id: string) {
  const { data } = await api.delete(`/v1/school-web/gallery/categories/${id}`);
  return data;
}

export async function fetchSchoolWebGalleryTags() {
  const { data } = await api.get('/v1/school-web/gallery/tags');
  return data as Array<{ id: string; name: string; slug: string }>;
}

export async function upsertSchoolWebGalleryTag(payload: {
  id?: string;
  name: string;
  slug?: string;
}) {
  const { data } = await api.post('/v1/school-web/gallery/tags', payload);
  return data;
}

export async function deleteSchoolWebGalleryTag(id: string) {
  const { data } = await api.delete(`/v1/school-web/gallery/tags/${id}`);
  return data;
}

export async function bulkSchoolWebGalleryItems(
  albumId: string,
  payload: { ids: string[]; action: 'DELETE' | 'MOVE'; albumId?: string },
) {
  const { data } = await api.post(`/v1/school-web/gallery/${albumId}/images/bulk`, payload);
  return data;
}

export async function reorderSchoolWebGalleryItems(albumId: string, itemIds: string[]) {
  const { data } = await api.post(`/v1/school-web/gallery/${albumId}/reorder`, { itemIds });
  return data;
}

export async function setSchoolWebGalleryCover(albumId: string, itemId: string) {
  const { data } = await api.post(`/v1/school-web/gallery/${albumId}/cover/${itemId}`);
  return data;
}

export async function patchSchoolWebGalleryItem(itemId: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/school-web/gallery/items/${itemId}`, payload);
  return data;
}

export async function uploadSchoolWebGalleryImages(albumId: string, files: File[]) {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  const { data } = await galleryUploadApi.post(`/v1/school-web/gallery/${albumId}/images`, form, {
    timeout: 180_000,
  });
  return data as SchoolWebGalleryAlbum & { page: number; pageSize: number; photoCount: number };
}

export async function replaceSchoolWebGalleryImage(albumId: string, itemId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await galleryUploadApi.post(
    `/v1/school-web/gallery/${albumId}/items/${itemId}/file`,
    form,
    {
      timeout: 120_000,
    },
  );
  return data;
}
