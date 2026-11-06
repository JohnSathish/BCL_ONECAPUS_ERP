import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { SchoolSiteHeader } from '@/components/school-web/school-site-chrome';
import { SchoolSiteFooter } from '@/components/school-web/school-site-footer';
import { SchoolJsonLd } from '@/components/school-web/school-json-ld';
import { SchoolWebHostProvider } from '@/components/school-web/school-web-host';
import '@/components/school-web/school-site.css';
import { SchoolLaunchPopup } from '@/components/school-web/school-launch-popup';
import { parseLaunchPopup } from '@/lib/school-web/launch-popup';
import { extras, fetchSchoolWebBundle, schoolWebRequestHost } from '@/lib/school-web/public';
import { schoolGraphFromSite, schoolPublicOrigin, seoBag } from '@/lib/school-web/seo';

/** Bundled faces. next/font/google fetches Google at build time and fails in Docker. */
const slsSans = localFont({
  src: [
    { path: './fonts/plus-jakarta-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/plus-jakarta-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/plus-jakarta-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/plus-jakarta-sans-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sls-sans',
  display: 'swap',
});

const slsSerif = localFont({
  src: [
    { path: './fonts/lora-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/lora-latin-400-italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/lora-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/lora-latin-500-italic.woff2', weight: '500', style: 'italic' },
    { path: './fonts/lora-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/lora-latin-600-italic.woff2', weight: '600', style: 'italic' },
    { path: './fonts/lora-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/lora-latin-700-italic.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-sls-serif',
  display: 'swap',
});

const siteClass = `sls-site ${slsSans.variable} ${slsSerif.variable}`;

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
      <div className={siteClass}>
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
  const launch = parseLaunchPopup(bundle.homepage.find((section) => section.key === 'launchPopup'));
  return (
    <SchoolWebHostProvider host={host}>
      <div className={siteClass}>
        <SchoolJsonLd data={schoolGraphFromSite(bundle.site, origin)} />
        <SchoolSiteHeader bundle={bundle} logo={logo} host={host} />
        <main>{children}</main>
        <SchoolSiteFooter bundle={bundle} host={host} />
        <SchoolLaunchPopup config={{ ...launch, logoUrl: launch.logoUrl || logo }} />
      </div>
    </SchoolWebHostProvider>
  );
}
