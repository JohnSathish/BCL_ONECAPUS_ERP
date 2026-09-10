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
    path: '/events',
    siteName: bundle.site.displayName,
    title: 'Events | St. Luke’s Secondary School, Tura',
    description:
      'Upcoming events and school programmes at St. Luke’s Secondary School, Walbakgre, Tura. Dates appear when the office publishes them.',
    logo: String(extras(bundle).logoUrl || '/school-sis/st-lukes-logo.png'),
  });
}

export default async function SchoolSiteEventsPage() {
  const [bundle, host] = await Promise.all([fetchSchoolWebBundle(), schoolWebRequestHost()]);
  if (!bundle) return null;
  const events = bundle.events ?? [];
  const origin = schoolPublicOrigin(extras(bundle), host);
  const crumbs = crumbsFor('events', 'Events');
  return (
    <div className="sls-page">
      <SchoolJsonLd data={breadcrumbJsonLd(origin, crumbs)} />
      <SchoolInteriorPage
        slug="events"
        kicker="EVENTS"
        title="Upcoming events"
        lede="Dates, programmes and school activities appear here when the office publishes them."
        site={bundle.site}
        extrasJson={extras(bundle)}
        crumbs={crumbs}
        host={host}
      >
        <div className="sls-grid sls-cards-3">
          {events.map((event) => (
            <a
              key={event.id}
              href={schoolWebPath(`/events/${event.slug}`, host)}
              className="sls-card"
            >
              <p className="sls-kicker">{new Date(event.startsAt).toLocaleDateString('en-IN')}</p>
              <h3>{event.title}</h3>
              {event.venue ? <p className="sls-muted">{event.venue}</p> : null}
            </a>
          ))}
        </div>
        {!events.length ? (
          <p className="sls-muted">
            No published events yet. Upcoming events will appear when the office publishes them.
          </p>
        ) : null}
      </SchoolInteriorPage>
    </div>
  );
}
