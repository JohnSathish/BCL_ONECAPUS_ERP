import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { isSchoolWebPublicHost } from '@/lib/school-web/hosts';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host') || '';
  if (!isSchoolWebPublicHost(host)) {
    return { rules: { userAgent: '*', allow: '/' } };
  }
  const origin = host.includes('localhost')
    ? `http://${host.split(':')[0]}:3000`
    : 'https://stlukestura.in';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/_next/static/', '/_next/image', '/school-sis/', '/uploads/'],
        disallow: [
          '/admin',
          '/admin/',
          '/dashboard',
          '/login',
          '/api/',
          '/school-site',
          '/school-site/',
          '/student-portal',
          '/parent-portal',
          '/teacher-portal',
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
