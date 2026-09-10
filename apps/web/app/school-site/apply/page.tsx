import type { Metadata } from 'next';
import SchoolSisPublicApplyPage from '@/app/school-sis-portal/apply/page';
import { SchoolInteriorPage } from '@/components/school-web/school-interior-page';
import {
  extras,
  fetchSchoolWebBundle,
  fetchSchoolWebPage,
  schoolWebRequestHost,
} from '@/lib/school-web/public';
import { asSeo, crumbsFor, buildSchoolMetadata, schoolPublicOrigin } from '@/lib/school-web/seo';

export async function generateMetadata(): Promise<Metadata> {
  const [bundle, host] = await Promise.all([fetchSchoolWebBundle(), schoolWebRequestHost()]);
  if (!bundle) return {};
  const origin = schoolPublicOrigin(extras(bundle), host);
  return buildSchoolMetadata({
    origin,
    path: '/apply',
    siteName: bundle.site.displayName,
    title: 'Apply for admission | St. Luke’s Secondary School, Tura',
    description:
      'Submit an online application to St. Luke’s Secondary School, Walbakgre, Tura, when an admission cycle is open. Families may also contact the school office.',
    logo: String(extras(bundle).logoUrl || '/school-sis/st-lukes-logo.png'),
    seo: { robotsIndex: false, robotsFollow: true },
    published: false,
  });
}

export default async function SchoolSiteApplyPage() {
  const [bundle, page, host] = await Promise.all([
    fetchSchoolWebBundle(),
    fetchSchoolWebPage('apply'),
    schoolWebRequestHost(),
  ]);
  if (!bundle) {
    return (
      <div className="sls-page">
        <SchoolSisPublicApplyPage />
      </div>
    );
  }
  const crumbs = crumbsFor('apply', page?.title || 'Apply', asSeo(page?.seoJson));
  return (
    <article className="sls-page">
      <SchoolInteriorPage
        slug="apply"
        kicker="ADMISSIONS"
        title={page?.title || 'Admission Process'}
        site={bundle.site}
        extrasJson={extras(bundle)}
        seoJson={page?.seoJson}
        crumbs={crumbs}
        host={host}
      >
        <SchoolSisPublicApplyPage embedded />
      </SchoolInteriorPage>
    </article>
  );
}
