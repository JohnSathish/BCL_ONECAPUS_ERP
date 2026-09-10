import type { Metadata } from 'next';
import { SchoolSiteHeader } from '@/components/school-web/school-site-chrome';
import { SchoolSiteFooter } from '@/components/school-web/school-site-footer';
import { SchoolJsonLd } from '@/components/school-web/school-json-ld';
import { SchoolWebHostProvider } from '@/components/school-web/school-web-host';
import '@/components/school-web/school-site.css';
import { extras, fetchSchoolWebBundle, schoolWebRequestHost } from '@/lib/school-web/public';
import { schoolGraphFromSite, schoolPublicOrigin, seoBag } from '@/lib/school-web/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [bundle, host] = await Promise.all([fetchSchoolWebBundle(), schoolWebRequestHost()]);
  if (!bundle) return { title: "St. Luke's Secondary School, Tura" };
  const extrasJson = extras(bundle);
  const origin = schoolPublicOrigin(extrasJson, host);
  const logo = String(extrasJson.logoUrl || '/school-sis/st-lukes-logo.png');
  return {
    metadataBase: new URL(origin),
    icons: { icon: logo, apple: logo },
    title: {
      default: bundle.site.seoTitle || "St. Luke's Secondary School, Tura | Official Website",
      template: '%s',
    },
    description: bundle.site.seoDescription || undefined,
    verification: seoBag(extrasJson).googleSiteVerification
      ? { google: String(seoBag(extrasJson).googleSiteVerification) }
      : undefined,
  };
}

export default async function SchoolSiteLayout({ children }: { children: React.ReactNode }) {
  const [bundle, host] = await Promise.all([fetchSchoolWebBundle(), schoolWebRequestHost()]);
  if (!bundle) {
    return (
      <div className="sls-site">
        <main className="sls-wrap sls-page">
          <p>
            The school website is not available yet. Confirm the API is running and the St. Luke’s
            website CMS is seeded.
          </p>
        </main>
      </div>
    );
  }
  const extrasJson = extras(bundle);
  const origin = schoolPublicOrigin(extrasJson, host);
  const logo = String(extrasJson.logoUrl || '/school-sis/st-lukes-logo.png');
  return (
    <SchoolWebHostProvider host={host}>
      <div className="sls-site">
        <SchoolJsonLd data={schoolGraphFromSite(bundle.site, origin)} />
        <SchoolSiteHeader bundle={bundle} logo={logo} host={host} />
        <main>{children}</main>
        <SchoolSiteFooter bundle={bundle} host={host} />
      </div>
    </SchoolWebHostProvider>
  );
}
