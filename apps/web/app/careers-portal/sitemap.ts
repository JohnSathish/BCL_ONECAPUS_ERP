import type { MetadataRoute } from 'next';
import { unwrapApiPayload } from '@/lib/http/api-envelope';

const CAREERS_BASE = process.env.CAREERS_PUBLIC_URL ?? 'https://career.donboscocollege.ac.in';
const API_BASE = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001/api';
const CAREER_HOST = process.env.NEXT_PUBLIC_CAREER_HOST ?? 'career.demo.localhost';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${CAREERS_BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${CAREERS_BASE}/jobs`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${CAREERS_BASE}/application-status`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  try {
    const res = await fetch(`${API_BASE}/v1/careers/portal/sitemap`, {
      headers: { 'X-Login-Host': CAREER_HOST, Host: CAREER_HOST },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return staticPages;
    const jobs = unwrapApiPayload<Array<{ slug: string; updatedAt?: string }>>(await res.json());
    const jobPages = jobs.map((j) => ({
      url: `${CAREERS_BASE}/jobs/${j.slug}`,
      lastModified: j.updatedAt ? new Date(j.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
    return [...staticPages, ...jobPages];
  } catch {
    return staticPages;
  }
}
