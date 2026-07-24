import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/content';

export default function robots(): MetadataRoute.Robots {
  let host = 'donboscocollege.ac.in';
  try {
    host = new URL(siteUrl).host;
  } catch {
    // keep default
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
    sitemap: `${siteUrl.replace(/\/+$/, '')}/sitemap.xml`,
    host,
  };
}
