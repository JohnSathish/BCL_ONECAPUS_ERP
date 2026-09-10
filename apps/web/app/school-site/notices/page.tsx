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
    path: '/notices',
    siteName: bundle.site.displayName,
    title: 'Notices | St. Luke’s Secondary School, Tura',
    description:
      'Official notices from St. Luke’s Secondary School, Tura. Academic updates, school information and published announcements from the school office.',
    logo: String(extras(bundle).logoUrl || '/school-sis/st-lukes-logo.png'),
  });
}

export default async function SchoolSiteNoticesPage() {
  const [bundle, host] = await Promise.all([fetchSchoolWebBundle(), schoolWebRequestHost()]);
  if (!bundle) return null;
  const notices = bundle.notices ?? [];
  const origin = schoolPublicOrigin(extras(bundle), host);
  const crumbs = crumbsFor('notices', 'Notices');
  return (
    <div className="sls-page">
      <SchoolJsonLd data={breadcrumbJsonLd(origin, crumbs)} />
      <SchoolInteriorPage
        slug="notices"
        kicker="NEWS & NOTICES"
        title="Notice board"
        lede="Published school notices. Each notice has its own page for parents and students to read in full."
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
        {!notices.length ? <p className="sls-muted">No published notices yet.</p> : null}
      </SchoolInteriorPage>
    </div>
  );
}
