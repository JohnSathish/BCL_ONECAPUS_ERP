import type { Metadata } from 'next';
import {
  SchoolPrincipalMessage,
  principalFromExtras,
} from '@/components/school-web/school-principal-message';
import { SchoolInteriorPage } from '@/components/school-web/school-interior-page';
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
import { notFound } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const [bundle, page, host] = await Promise.all([
    fetchSchoolWebBundle(),
    fetchSchoolWebPage('principal'),
    schoolWebRequestHost(),
  ]);
  if (!bundle || !page) return {};
  const origin = schoolPublicOrigin(extras(bundle), host);
  const seo = asSeo(page.seoJson);
  return buildSchoolMetadata({
    origin,
    path: '/principal',
    siteName: bundle.site.displayName,
    title:
      seo.title || page.seoTitle || 'Message of the Principal | St. Luke’s Secondary School, Tura',
    description:
      seo.description ||
      page.seoDescription ||
      'Message of the Principal, Fr. Bromith Bernard G. Sangma, St. Luke’s Higher Secondary School, Walbakgre, Tura.',
    seo,
    logo: String(extras(bundle).logoUrl || '/school-sis/st-lukes-logo.png'),
  });
}

export default async function SchoolSitePrincipalPage() {
  const [bundle, page, host] = await Promise.all([
    fetchSchoolWebBundle(),
    fetchSchoolWebPage('principal'),
    schoolWebRequestHost(),
  ]);
  if (!bundle || !page) notFound();
  const origin = schoolPublicOrigin(extras(bundle), host);
  const crumbs = crumbsFor('principal', page.title, asSeo(page.seoJson));
  return (
    <article className="sls-page">
      <SchoolJsonLd data={breadcrumbJsonLd(origin, crumbs)} />
      <SchoolInteriorPage
        slug="principal"
        kicker="FROM THE PRINCIPAL"
        title={page.title}
        lede="A message from Fr. Bromith Bernard G. Sangma, Principal of St. Luke’s Higher Secondary School, Walbakgre."
        site={bundle.site}
        extrasJson={extras(bundle)}
        seoJson={page.seoJson}
        crumbs={crumbs}
        host={host}
      >
        <SchoolPrincipalMessage
          identity={principalFromExtras(extras(bundle))}
          paragraphs={pageParagraphs(page)}
          host={host}
        />
      </SchoolInteriorPage>
    </article>
  );
}
