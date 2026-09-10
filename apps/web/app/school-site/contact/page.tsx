import type { Metadata } from 'next';
import { SchoolContactForm } from '@/components/school-web/school-contact-form';
import { SchoolContactMap } from '@/components/school-web/school-contact-map';
import { SchoolInteriorPage } from '@/components/school-web/school-interior-page';
import { SchoolJsonLd } from '@/components/school-web/school-json-ld';
import {
  extras,
  fetchSchoolWebBundle,
  fetchSchoolWebPage,
  pageParagraphs,
  schoolWebRequestHost,
} from '@/lib/school-web/public';
import { ST_LUKES_MAP_LAT, ST_LUKES_MAP_LNG, ST_LUKES_MAPS_URL } from '@/lib/school-web/maps';
import {
  asSeo,
  breadcrumbJsonLd,
  buildSchoolMetadata,
  crumbsFor,
  schoolGraphFromSite,
  schoolPublicOrigin,
  seoBag,
} from '@/lib/school-web/seo';

export async function generateMetadata(): Promise<Metadata> {
  const [bundle, page, host] = await Promise.all([
    fetchSchoolWebBundle(),
    fetchSchoolWebPage('contact'),
    schoolWebRequestHost(),
  ]);
  if (!bundle) return {};
  const origin = schoolPublicOrigin(extras(bundle), host);
  const seo = asSeo(page?.seoJson);
  return buildSchoolMetadata({
    origin,
    path: '/contact',
    siteName: bundle.site.displayName,
    title: seo.title || page?.seoTitle || 'Contact St. Luke’s Secondary School, Tura',
    description:
      seo.description ||
      page?.seoDescription ||
      'Contact St. Luke’s Secondary School at Walbakgre, P.O. Dakopgre, Tura – 794101, West Garo Hills, Meghalaya. Send an enquiry to the school office.',
    seo,
    logo: String(extras(bundle).logoUrl || '/school-sis/st-lukes-logo.png'),
    googleVerification: String(seoBag(extras(bundle)).googleSiteVerification || ''),
  });
}

export default async function SchoolSiteContactPage() {
  const [bundle, page, host] = await Promise.all([
    fetchSchoolWebBundle(),
    fetchSchoolWebPage('contact'),
    schoolWebRequestHost(),
  ]);
  if (!bundle) return null;
  const origin = schoolPublicOrigin(extras(bundle), host);
  const extrasJson = extras(bundle);
  const crumbs = crumbsFor('contact', 'Contact', asSeo(page?.seoJson));
  const address = [bundle.site.addressLine, `${bundle.site.district}, ${bundle.site.state}`].join(
    ', ',
  );
  const mapQuery = `${bundle.site.displayName}, ${bundle.site.addressLine}, ${bundle.site.district}, ${bundle.site.state} ${bundle.site.pin}`;
  const seo = seoBag(extrasJson);
  const mapsUrl = String(seo.googleMapsUrl || ST_LUKES_MAPS_URL);
  const mapLat = String(seo.latitude || ST_LUKES_MAP_LAT);
  const mapLng = String(seo.longitude || ST_LUKES_MAP_LNG);
  const hours = String(extrasJson.officeHours || '').trim();
  const note = String(extrasJson.contactNote || '').trim();
  const paras = page ? pageParagraphs(page) : [];
  return (
    <div className="sls-page">
      <SchoolJsonLd
        data={[...schoolGraphFromSite(bundle.site, origin), breadcrumbJsonLd(origin, crumbs)]}
      />
      <SchoolInteriorPage
        slug="contact"
        kicker="VISIT"
        title="Contact & location"
        lede="School office hours are 9:00 a.m. to 2:30 p.m. The Principal may be met during school hours only."
        site={bundle.site}
        extrasJson={extrasJson}
        seoJson={page?.seoJson}
        crumbs={crumbs}
        host={host}
      >
        <div className="sls-prose sls-prose-wide">
          <p>
            {bundle.site.displayName}
            <br />
            {bundle.site.addressLine}
            <br />
            {bundle.site.district}, {bundle.site.state} {bundle.site.pin}
            <br />
            India
          </p>
          {bundle.site.phone ? (
            <p>
              <a href={`tel:${bundle.site.phone.replace(/\s+/g, '')}`}>{bundle.site.phone}</a>
            </p>
          ) : null}
          {bundle.site.email ? (
            <p>
              <a href={`mailto:${bundle.site.email}`}>{bundle.site.email}</a>
            </p>
          ) : null}
          {hours ? <p>{hours}</p> : null}
          {!bundle.site.phone && !bundle.site.email && note ? <p>{note}</p> : null}
          {paras.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <SchoolContactForm />
        <div style={{ marginTop: '1.5rem' }}>
          <SchoolContactMap
            query={mapQuery}
            mapsUrl={mapsUrl}
            lat={mapLat}
            lng={mapLng}
            locationLabel="Our Location"
            directionsLabel="Get Directions"
            schoolName={bundle.site.displayName}
            address={address}
          />
        </div>
      </SchoolInteriorPage>
    </div>
  );
}
