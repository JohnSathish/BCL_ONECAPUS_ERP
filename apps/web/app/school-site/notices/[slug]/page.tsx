import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SchoolInteriorPage } from '@/components/school-web/school-interior-page';
import { SchoolJsonLd } from '@/components/school-web/school-json-ld';
import {
  extras,
  fetchSchoolWebBundle,
  fetchSchoolWebNotice,
  schoolWebPath,
  schoolWebRequestHost,
} from '@/lib/school-web/public';
import {
  asSeo,
  breadcrumbJsonLd,
  buildSchoolMetadata,
  schoolPublicOrigin,
} from '@/lib/school-web/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [notice, bundle, host] = await Promise.all([
    fetchSchoolWebNotice(slug),
    fetchSchoolWebBundle(),
    schoolWebRequestHost(),
  ]);
  if (!notice || !bundle) return {};
  const origin = schoolPublicOrigin(extras(bundle), host);
  const seo = asSeo(notice.seoJson);
  return buildSchoolMetadata({
    origin,
    path: `/notices/${slug}`,
    siteName: bundle.site.displayName,
    title: seo.title || `${notice.title} | St. Luke’s Secondary School, Tura`,
    description: seo.description || notice.body.slice(0, 150),
    seo,
    logo: String(extras(bundle).logoUrl || '/school-sis/st-lukes-logo.png'),
  });
}

export default async function SchoolSiteNoticeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [notice, bundle, host] = await Promise.all([
    fetchSchoolWebNotice(slug),
    fetchSchoolWebBundle(),
    schoolWebRequestHost(),
  ]);
  if (!notice || !bundle) notFound();
  const origin = schoolPublicOrigin(extras(bundle), host);
  const crumbs = [
    { href: '/', label: 'Home' },
    { href: '/notices', label: 'Notices' },
    { href: `/notices/${slug}`, label: asSeo(notice.seoJson).breadcrumbTitle || notice.title },
  ];
  return (
    <article className="sls-page">
      <SchoolJsonLd
        data={[
          breadcrumbJsonLd(origin, crumbs),
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: notice.title,
            datePublished: notice.publishedAt || undefined,
            dateModified: notice.updatedAt || notice.publishedAt || undefined,
            articleSection: notice.category,
            mainEntityOfPage: `${origin}/notices/${slug}`,
          },
        ]}
      />
      <SchoolInteriorPage
        slug="notices"
        kicker={notice.category || 'NOTICE'}
        title={notice.title}
        lede={
          notice.publishedAt
            ? `Published ${new Date(notice.publishedAt).toLocaleDateString('en-IN')}`
            : undefined
        }
        site={bundle.site}
        extrasJson={extras(bundle)}
        seoJson={notice.seoJson}
        crumbs={crumbs}
        host={host}
      >
        <div className="sls-prose sls-prose-wide">
          {notice.body.split('\n').map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <p className="sls-article-cta">
          <a className="sls-btn sls-btn-navy" href={schoolWebPath('/notices', host)}>
            All notices
          </a>
        </p>
      </SchoolInteriorPage>
    </article>
  );
}
