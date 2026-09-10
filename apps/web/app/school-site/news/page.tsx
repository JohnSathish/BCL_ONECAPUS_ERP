import type { Metadata } from 'next';
import { SchoolInteriorPage } from '@/components/school-web/school-interior-page';
import { SchoolJsonLd } from '@/components/school-web/school-json-ld';
import {
  extras,
  fetchSchoolWebBundle,
  schoolWebPath,
  schoolWebRequestHost,
} from '@/lib/school-web/public';
import {
  breadcrumbJsonLd,
  buildSchoolMetadata,
  crumbsFor,
  schoolPublicOrigin,
} from '@/lib/school-web/seo';

export async function generateMetadata(): Promise<Metadata> {
  const [bundle, host] = await Promise.all([fetchSchoolWebBundle(), schoolWebRequestHost()]);
  if (!bundle) return {};
  const origin = schoolPublicOrigin(extras(bundle), host);
  return buildSchoolMetadata({
    origin,
    path: '/news',
    siteName: bundle.site.displayName,
    title: 'News | St. Luke’s Secondary School, Tura',
    description:
      'School news from St. Luke’s Secondary School, Tura. Stories and updates are published as notices by the school office.',
    logo: String(extras(bundle).logoUrl || '/school-sis/st-lukes-logo.png'),
  });
}

export default async function SchoolSiteNewsPage() {
  const [bundle, host] = await Promise.all([fetchSchoolWebBundle(), schoolWebRequestHost()]);
  if (!bundle) return null;
  const notices = bundle.notices ?? [];
  const origin = schoolPublicOrigin(extras(bundle), host);
  const crumbs = crumbsFor('news', 'News');
  return (
    <div className="sls-page">
      <SchoolJsonLd data={breadcrumbJsonLd(origin, crumbs)} />
      <SchoolInteriorPage
        slug="news"
        kicker="NEWS"
        title="School news"
        lede="News items are published on the official notice board. Open a notice to read the full text."
        site={bundle.site}
        extrasJson={extras(bundle)}
        crumbs={crumbs}
        host={host}
      >
        <div className="sls-grid sls-cards-3">
          {notices.map((n) => (
            <a key={n.id} href={schoolWebPath(`/notices/${n.slug}`, host)} className="sls-card">
              <p className="sls-kicker">{n.category}</p>
              <h3>{n.title}</h3>
              {n.publishedAt ? (
                <p className="sls-muted">{new Date(n.publishedAt).toLocaleDateString('en-IN')}</p>
              ) : null}
            </a>
          ))}
        </div>
      </SchoolInteriorPage>
    </div>
  );
}
