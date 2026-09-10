import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SchoolJsonLd } from '@/components/school-web/school-json-ld';
import {
  SchoolCmsBody,
  SchoolInteriorPage,
  pageKicker,
} from '@/components/school-web/school-interior-page';
import { SchoolFacilitiesBody } from '@/components/school-web/school-facilities-body';
import {
  fetchSchoolWebPage,
  pageParagraphs,
  schoolWebRequestHost,
  fetchSchoolWebBundle,
  extras,
} from '@/lib/school-web/public';
import {
  asSeo,
  breadcrumbJsonLd,
  buildSchoolMetadata,
  crumbsFor,
  schoolPublicOrigin,
  seoBag,
} from '@/lib/school-web/seo';

const RESERVED = new Set([
  'notices',
  'gallery',
  'apply',
  'contact',
  'principal',
  'events',
  'news',
  'about',
]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (RESERVED.has(slug)) return {};
  const [page, bundle, host] = await Promise.all([
    fetchSchoolWebPage(slug),
    fetchSchoolWebBundle(),
    schoolWebRequestHost(),
  ]);
  if (!page || !bundle) return {};
  const origin = schoolPublicOrigin(extras(bundle), host);
  const seo = asSeo(page.seoJson);
  const description = seo.description || page.seoDescription || pageParagraphs(page)[0] || '';
  return buildSchoolMetadata({
    origin,
    path: `/${slug}`,
    siteName: bundle.site.displayName,
    title: seo.title || page.seoTitle || page.title,
    description,
    seo,
    logo: String(extras(bundle).logoUrl || '/school-sis/st-lukes-logo.png'),
    googleVerification: String(seoBag(extras(bundle)).googleSiteVerification || ''),
  });
}

export default async function SchoolSiteCmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (RESERVED.has(slug)) notFound();
  const [page, bundle, host] = await Promise.all([
    fetchSchoolWebPage(slug),
    fetchSchoolWebBundle(),
    schoolWebRequestHost(),
  ]);
  if (!page || !bundle) notFound();
  const paras = pageParagraphs(page);
  const origin = schoolPublicOrigin(extras(bundle), host);
  const seo = asSeo(page.seoJson);
  const crumbs = crumbsFor(slug, page.title, seo);
  return (
    <article className="sls-page">
      <SchoolJsonLd data={breadcrumbJsonLd(origin, crumbs)} />
      <SchoolInteriorPage
        slug={slug}
        kicker={pageKicker(slug)}
        title={page.title}
        site={bundle.site}
        extrasJson={extras(bundle)}
        seoJson={page.seoJson}
        crumbs={crumbs}
        host={host}
        facts={
          slug === 'history'
            ? [
                { value: '2006', label: 'Pre-nursery at Walbakgre' },
                { value: '2010', label: 'Named St. Luke’s School' },
                { value: 'XI', label: 'Higher Secondary from 2026' },
              ]
            : undefined
        }
      >
        {slug === 'facilities' ? (
          <SchoolFacilitiesBody />
        ) : (
          <SchoolCmsBody
            paragraphs={paras}
            variant={slug === 'examinations' || slug === 'rules' ? 'rules' : 'prose'}
          />
        )}
      </SchoolInteriorPage>
    </article>
  );
}
