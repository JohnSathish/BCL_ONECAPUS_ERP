import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SchoolInteriorPage } from '@/components/school-web/school-interior-page';
import { SchoolJsonLd } from '@/components/school-web/school-json-ld';
import {
  extras,
  fetchSchoolWebBundle,
  fetchSchoolWebEvent,
  schoolWebPath,
  schoolWebRequestHost,
} from '@/lib/school-web/public';
import {
  asSeo,
  breadcrumbJsonLd,
  buildSchoolMetadata,
  eventJsonLd,
  schoolPublicOrigin,
} from '@/lib/school-web/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [event, bundle, host] = await Promise.all([
    fetchSchoolWebEvent(slug),
    fetchSchoolWebBundle(),
    schoolWebRequestHost(),
  ]);
  if (!event || !bundle) return {};
  const origin = schoolPublicOrigin(extras(bundle), host);
  const seo = asSeo(event.seoJson);
  return buildSchoolMetadata({
    origin,
    path: `/events/${slug}`,
    siteName: bundle.site.displayName,
    title: seo.title || `${event.title} | St. Luke’s Secondary School, Tura`,
    description:
      seo.description ||
      event.summary ||
      `Event at St. Luke’s Secondary School, Tura: ${event.title}.`,
    seo,
    logo: String(extras(bundle).logoUrl || '/school-sis/st-lukes-logo.png'),
  });
}

export default async function SchoolSiteEventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [event, bundle, host] = await Promise.all([
    fetchSchoolWebEvent(slug),
    fetchSchoolWebBundle(),
    schoolWebRequestHost(),
  ]);
  if (!event || !bundle) notFound();
  const origin = schoolPublicOrigin(extras(bundle), host);
  const crumbs = [
    { href: '/', label: 'Home' },
    { href: '/events', label: 'Events' },
    { href: `/events/${slug}`, label: asSeo(event.seoJson).breadcrumbTitle || event.title },
  ];
  return (
    <article className="sls-page">
      <SchoolJsonLd
        data={[
          breadcrumbJsonLd(origin, crumbs),
          eventJsonLd({
            origin,
            name: event.title,
            description: event.summary,
            start: event.startsAt,
            end: event.endsAt,
            venue: event.venue || bundle.site.displayName,
            url: `${origin}/events/${slug}`,
          }),
        ]}
      />
      <SchoolInteriorPage
        slug="events"
        kicker="EVENT"
        title={event.title}
        lede={[
          new Date(event.startsAt).toLocaleString('en-IN'),
          event.endsAt ? new Date(event.endsAt).toLocaleString('en-IN') : '',
          event.venue || '',
        ]
          .filter(Boolean)
          .join(' · ')}
        site={bundle.site}
        extrasJson={extras(bundle)}
        seoJson={event.seoJson}
        crumbs={crumbs}
        host={host}
      >
        {event.summary ? (
          <div className="sls-prose sls-prose-wide">
            {event.summary.split('\n').map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        ) : null}
        <p className="sls-article-cta">
          <a className="sls-btn sls-btn-gold" href={schoolWebPath('/events', host)}>
            All events
          </a>
        </p>
      </SchoolInteriorPage>
    </article>
  );
}
