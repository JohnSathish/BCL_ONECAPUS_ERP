import type { Metadata } from 'next';
import { SchoolInteriorPage } from '@/components/school-web/school-interior-page';
import { SchoolJsonLd } from '@/components/school-web/school-json-ld';
import { SchoolPrivacyPolicyBody } from '@/components/school-web/school-privacy-policy-body';
import { extras, fetchSchoolWebBundle, schoolWebRequestHost } from '@/lib/school-web/public';
import {
  ST_LUKES_PRIVACY_POLICY_DESCRIPTION,
  ST_LUKES_PRIVACY_POLICY_PATH,
  ST_LUKES_PRIVACY_POLICY_SECTIONS,
  ST_LUKES_PRIVACY_POLICY_TITLE,
  ST_LUKES_PRIVACY_POLICY_UPDATED,
} from '@/lib/school-web/privacy-policy-content';
import {
  breadcrumbJsonLd,
  buildSchoolMetadata,
  crumbsFor,
  schoolPublicOrigin,
} from '@/lib/school-web/seo';

export async function generateMetadata(): Promise<Metadata> {
  const [bundle, host] = await Promise.all([fetchSchoolWebBundle(), schoolWebRequestHost()]);
  const origin = bundle ? schoolPublicOrigin(extras(bundle), host) : 'https://stlukestura.in';
  return buildSchoolMetadata({
    origin,
    path: ST_LUKES_PRIVACY_POLICY_PATH,
    siteName: bundle?.site.displayName || "St. Luke's Secondary School, Tura",
    title: ST_LUKES_PRIVACY_POLICY_TITLE,
    description: ST_LUKES_PRIVACY_POLICY_DESCRIPTION,
    seo: {
      title: ST_LUKES_PRIVACY_POLICY_TITLE,
      description: ST_LUKES_PRIVACY_POLICY_DESCRIPTION,
      canonicalPath: ST_LUKES_PRIVACY_POLICY_PATH,
      robotsIndex: true,
      robotsFollow: true,
      schemaType: 'WebPage',
      breadcrumbTitle: 'Privacy Policy',
    },
    logo: String(
      bundle
        ? extras(bundle).logoUrl || '/school-sis/st-lukes-logo.png'
        : '/school-sis/st-lukes-logo.png',
    ),
  });
}

export default async function SchoolSitePrivacyPolicyPage() {
  const [bundle, host] = await Promise.all([fetchSchoolWebBundle(), schoolWebRequestHost()]);
  if (!bundle) return null;
  const extrasJson = extras(bundle);
  const origin = schoolPublicOrigin(extrasJson, host);
  const crumbs = crumbsFor('privacy-policy', 'Privacy Policy');
  return (
    <article className="sls-page">
      <SchoolJsonLd data={breadcrumbJsonLd(origin, crumbs)} />
      <SchoolInteriorPage
        slug="privacy-policy"
        kicker="PRIVACY"
        title="Privacy Policy"
        lede={`How St. Luke’s Secondary School uses information in the school website and the St. Luke’s School app. Last updated ${ST_LUKES_PRIVACY_POLICY_UPDATED}.`}
        site={bundle.site}
        extrasJson={extrasJson}
        seoJson={{
          hero: {
            enabled: true,
            eyebrow: 'PRIVACY',
            subtitle: 'Google Play and website transparency for St. Luke’s School.',
          },
        }}
        crumbs={crumbs}
        host={host}
        showExplore={false}
      >
        <SchoolPrivacyPolicyBody sections={ST_LUKES_PRIVACY_POLICY_SECTIONS} />
      </SchoolInteriorPage>
    </article>
  );
}
