import type { MetadataRoute } from 'next';
import { unwrapApiPayload } from '@/lib/http/api-envelope';
import { JOURNALS_PUBLIC_URL } from '@/lib/journals-host';

const API_BASE = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001/api';
const JOURNAL_HOST = process.env.NEXT_PUBLIC_JOURNALS_HOST ?? 'transient.demo.localhost';
const JOURNAL_SLUG = process.env.NEXT_PUBLIC_JOURNAL_SLUG ?? 'transient';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = JOURNALS_PUBLIC_URL.replace(/\/$/, '');
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/current-issue`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/archives`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/search`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  try {
    const res = await fetch(`${API_BASE}/v1/journals/portal/sitemap`, {
      headers: {
        'X-Login-Host': JOURNAL_HOST,
        'X-Forwarded-Host': JOURNAL_HOST,
        'X-Journal-Slug': JOURNAL_SLUG,
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return staticPages;
    const entries = unwrapApiPayload<Array<{ id: string; path: string; updatedAt?: string }>>(
      await res.json(),
    );
    const articlePages = entries.map((e) => ({
      url: `${base}${e.path.startsWith('/') ? e.path : `/${e.path}`}`,
      lastModified: e.updatedAt ? new Date(e.updatedAt) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));
    return [...staticPages, ...articlePages];
  } catch {
    return staticPages;
  }
}
