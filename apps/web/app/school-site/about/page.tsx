import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SchoolAboutInterior } from '@/components/school-web/school-about-interior';
import { SchoolJsonLd } from '@/components/school-web/school-json-ld';
import {
  extras,
  fetchSchoolWebBundle,
  fetchSchoolWebPage,
  pageParagraphs,
  schoolWebRequestHost,
} from '@/lib/school-web/public';
import {
  asSeo,
  breadcrumbJsonLd,
  buildSchoolMetadata,
  crumbsFor,
  schoolPublicOrigin,
} from '@/lib/school-web/seo';

export async function generateMetadata(): Promise<Metadata> {
  const [bundle, page, host] = await Promise.all([
    fetchSchoolWebBundle(),
    fetchSchoolWebPage('about'),
    schoolWebRequestHost(),
  ]);
  if (!bundle || !page) return {};
  const origin = schoolPublicOrigin(extras(bundle), host);
  const seo = asSeo(page.seoJson);
  return buildSchoolMetadata({
    origin,
    path: '/about',
    siteName: bundle.site.displayName,
    title: seo.title || page.seoTitle || 'About the School | St. Luke’s Secondary School, Tura',
    description:
      seo.description ||
      page.seoDescription ||
      'St. Luke’s Secondary School, Walbakgre, Tura, grew from a Holy Cross pre-nursery in 2006, was named St. Luke’s in 2010, and now serves Nursery through Class XI.',
    seo,
    logo: String(extras(bundle).logoUrl || '/school-sis/st-lukes-logo.png'),
  });
}

export default async function SchoolSiteAboutPage() {
  const [bundle, page, host] = await Promise.all([
    fetchSchoolWebBundle(),
    fetchSchoolWebPage('about'),
    schoolWebRequestHost(),
  ]);
  if (!bundle || !page) notFound();
  const origin = schoolPublicOrigin(extras(bundle), host);
  const crumbs = crumbsFor('about', page.title, asSeo(page.seoJson));
  return (
    <article className="sls-page">
      <SchoolJsonLd data={breadcrumbJsonLd(origin, crumbs)} />
      <SchoolAboutInterior
        title={page.title}
        paragraphs={pageParagraphs(page)}
        extrasJson={extras(bundle)}
        seoJson={page.seoJson}
        crumbs={crumbs}
        site={bundle.site}
        host={host}
      />
    </article>
  );
}
