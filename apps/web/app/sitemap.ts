import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { extras, fetchSchoolWebBundle } from '@/lib/school-web/public';
import { asSeo, schoolPublicOrigin } from '@/lib/school-web/seo';
import { isSchoolWebPublicHost } from '@/lib/school-web/hosts';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get('host') || '';
  if (!isSchoolWebPublicHost(host)) return [];
  const bundle = await fetchSchoolWebBundle();
  if (!bundle) return [];
  const origin = schoolPublicOrigin(extras(bundle), host);
  const now = new Date();
  const staticPaths = ['/', '/notices', '/news', '/events', '/gallery', '/contact', '/principal'];
  const lastmodByPath = new Map<string, Date>();
  for (const p of bundle.pages) {
    lastmodByPath.set(`/${p.slug}`, p.updatedAt ? new Date(p.updatedAt) : now);
  }
  const pageUrls = bundle.pages
    .filter((p) => asSeo(p.seoJson).robotsIndex !== false)
    .filter((p) => !['contact', 'principal'].includes(p.slug))
    .map((p) => `/${p.slug}`);
  const noticeUrls = bundle.notices.map((n) => `/notices/${n.slug}`);
  const eventUrls = bundle.events.map((e) => `/events/${e.slug}`);
  const albumUrls = bundle.albums.map((a) => `/gallery/${a.slug}`);
  const paths = [
    ...new Set([...staticPaths, ...pageUrls, ...noticeUrls, ...eventUrls, ...albumUrls]),
  ];
  return paths.map((path) => ({
    url: path === '/' ? origin : `${origin}${path}`,
    lastModified: lastmodByPath.get(path) ?? now,
    changeFrequency: path === '/' ? 'weekly' : 'weekly',
    priority: path === '/' ? 1 : path.split('/').length === 2 ? 0.8 : 0.6,
  }));
}
