import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.CAREERS_PUBLIC_URL ?? 'https://career.donboscocollege.ac.in';
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${base}/careers-portal/sitemap.xml`,
  };
}
