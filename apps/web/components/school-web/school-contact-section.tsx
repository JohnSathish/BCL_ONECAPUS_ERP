import { schoolWebPath } from '@/lib/school-web/paths';
import { SchoolContactMap } from '@/components/school-web/school-contact-map';
import { ST_LUKES_MAP_LAT, ST_LUKES_MAP_LNG, ST_LUKES_MAPS_URL } from '@/lib/school-web/maps';
import { seoBag } from '@/lib/school-web/seo';
import type { SchoolWebBundle } from '@/lib/school-web/public';

function isCrestFile(src?: string) {
  const s = (src || '').toLowerCase();
  return !src || s.includes('logo') || s.includes('campus-hero');
}

export function SchoolContactSection({
  payload,
  site,
  extrasJson,
  host,
}: {
  payload: Record<string, unknown>;
  site: SchoolWebBundle['site'];
  extrasJson: Record<string, unknown>;
  host?: string | null;
}) {
  const kicker = String(payload.kicker || 'VISIT');
  const title = String(payload.title || 'Contact & location');
  const intro = String(payload.intro || payload.body || '');
  const applyLabel = String(payload.applyLabel || 'Apply Now');
  const applyHref = String(payload.applyHref || site.applyCtaUrl || '/apply');
  const contactLabel = String(payload.contactLabel || 'Contact the office');
  const contactHref = String(payload.contactHref || '/contact');
  const locationLabel = String(payload.locationLabel || 'Our Location');
  const directionsLabel = String(payload.directionsLabel || 'Get Directions');
  const seo = seoBag(extrasJson);
  const mapQuery = String(
    payload.mapQuery ||
      `${site.displayName}, ${site.addressLine}, ${site.district}, ${site.state} ${site.pin}`,
  );
  const mapsUrl = String(payload.mapsUrl || seo.googleMapsUrl || ST_LUKES_MAPS_URL);
  const mapLat = String(payload.mapLat || seo.latitude || ST_LUKES_MAP_LAT);
  const mapLng = String(payload.mapLng || seo.longitude || ST_LUKES_MAP_LNG);
  const campusPhoto = String(payload.campusPhotoUrl || '').trim();
  const campusAlt = String(payload.campusPhotoAlt || site.displayName);
  const campusTitle = String(payload.campusTitle || '');
  const campusCaption = String(payload.campusCaption || '');
  const campusHref = String(payload.campusHref || '/gallery');
  const welcomeQuote = String(payload.welcomeQuote || '').trim();
  const officeHours = String(payload.officeHours || extrasJson.officeHours || '').trim();
  const contactNote = String(extrasJson.contactNote || '').trim();
  const address = [site.addressLine, [site.district, site.state].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(', ');

  return (
    <section className="sls-visit" aria-labelledby="sls-visit-heading">
      <div className="sls-visit-bg" aria-hidden />
      <div className="sls-wrap sls-visit-grid">
        <div className="sls-visit-copy">
          <p className="sls-kicker sls-kicker-line">{kicker}</p>
          <h2 id="sls-visit-heading">{title}</h2>
          {intro ? <p className="sls-muted">{intro}</p> : null}
          <ul className="sls-visit-facts">
            <li>
              <span aria-hidden>
                <VisitIcon name="pin" />
              </span>
              <span>
                <strong>{site.displayName}</strong>
                <em>{address}</em>
              </span>
            </li>
            {site.phone ? (
              <li>
                <span aria-hidden>
                  <VisitIcon name="phone" />
                </span>
                <span>
                  <strong>
                    <a href={`tel:${site.phone.replace(/\s+/g, '')}`}>{site.phone}</a>
                  </strong>
                  <em>School office</em>
                </span>
              </li>
            ) : null}
            {site.email ? (
              <li>
                <span aria-hidden>
                  <VisitIcon name="mail" />
                </span>
                <span>
                  <strong>
                    <a href={`mailto:${site.email}`}>{site.email}</a>
                  </strong>
                  <em>Email</em>
                </span>
              </li>
            ) : null}
            {officeHours ? (
              <li>
                <span aria-hidden>
                  <VisitIcon name="clock" />
                </span>
                <span>
                  <strong>{officeHours}</strong>
                  <em>Office hours</em>
                </span>
              </li>
            ) : null}
          </ul>
          {!site.phone && !site.email && contactNote ? (
            <p className="sls-muted sls-visit-note">{contactNote}</p>
          ) : null}
          {welcomeQuote ? (
            <blockquote className="sls-visit-quote">
              <p>“{welcomeQuote}”</p>
              {site.motto ? <cite>{site.motto.replace(/·/g, ' • ')}</cite> : null}
            </blockquote>
          ) : site.motto ? (
            <p className="sls-visit-motto">{site.motto.replace(/·/g, ' • ')}</p>
          ) : null}
          <div className="sls-actions">
            <a className="sls-btn sls-btn-gold" href={schoolWebPath(applyHref, host)}>
              {applyLabel} <span aria-hidden>→</span>
            </a>
            <a className="sls-btn sls-btn-outline" href={schoolWebPath(contactHref, host)}>
              {contactLabel} <span aria-hidden>→</span>
            </a>
          </div>
        </div>
        <div className="sls-visit-card">
          <SchoolContactMap
            query={mapQuery}
            mapsUrl={mapsUrl}
            lat={mapLat}
            lng={mapLng}
            locationLabel={locationLabel}
            directionsLabel={directionsLabel}
            schoolName={site.displayName}
            address={address}
          />
          {campusPhoto && !isCrestFile(campusPhoto) ? (
            <a className="sls-visit-campus" href={schoolWebPath(campusHref, host)}>
              <img src={campusPhoto} alt={campusAlt} loading="lazy" />
              <span>
                <strong>{campusTitle || 'Our Campus'}</strong>
                {campusCaption ? <em>{campusCaption}</em> : null}
              </span>
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function VisitIcon({ name }: { name: 'pin' | 'phone' | 'mail' | 'clock' }) {
  const d = {
    pin: 'M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7zm0 9.5A2.5 2.5 0 1 0 9.5 9 2.5 2.5 0 0 0 12 11.5z',
    phone:
      'M6.5 3.5h3l1 4-2 1.5a12 12 0 0 0 6.5 6.5l1.5-2 4 1v3A2 2 0 0 1 19 19 16 16 0 0 1 5 5a2 2 0 0 1 1.5-1.5z',
    mail: 'M4 6h16v12H4zm0 0 8 6 8-6',
    clock: 'M12 3a9 9 0 1 1-9 9 9 9 0 0 1 9-9zm.8 4.2h-1.6v5.2l4 2.4.8-1.3-3.2-1.9z',
  }[name];
  return (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d={d} />
    </svg>
  );
}
