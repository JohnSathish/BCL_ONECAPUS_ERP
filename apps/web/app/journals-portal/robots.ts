import type { MetadataRoute } from 'next';
import { JOURNALS_PUBLIC_URL } from '@/lib/journals-host';

export default function robots(): MetadataRoute.Robots {
  const base = JOURNALS_PUBLIC_URL.replace(/\/$/, '');
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${base}/sitemap.xml`,
  };
}
