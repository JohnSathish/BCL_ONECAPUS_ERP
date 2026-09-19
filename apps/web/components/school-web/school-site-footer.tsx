import { aboutHighlights } from '@/components/school-web/school-about-principal-section';
import { SchoolFooterNewsletter } from '@/components/school-web/school-footer-newsletter';
import { SchoolFooterPresence } from '@/components/school-web/school-footer-presence';
import { schoolFooterSettings } from '@/lib/school-web/footer-settings';
import {
  schoolMapsDirectionsUrl,
  ST_LUKES_MAP_LAT,
  ST_LUKES_MAP_LNG,
  ST_LUKES_MAPS_URL,
} from '@/lib/school-web/maps';
import { schoolWebPath } from '@/lib/school-web/paths';
import { seoBag } from '@/lib/school-web/seo';

type FooterBundle = {
  site: {
    displayName: string;
    motto: string;
    addressLine: string;
    district: string;
    state: string;
    pin: string;
    email: string | null;
    phone: string | null;
    extrasJson: Record<string, unknown>;
  };
  homepage: Array<{ key: string; payload: Record<string, unknown> }>;
  menus: Array<{
    location: string;
    items: Array<{
      id: string;
      parentId: string | null;
      label: string;
      href: string;
      sortOrder: number;
      visible: boolean;
    }>;
  }>;
  pages: Array<{ slug: string }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function socialLinks(extrasJson: Record<string, unknown>) {
  const raw = asRecord(extrasJson.socialLinks);
  return (['facebook', 'instagram', 'youtube'] as const)
    .map((key) => ({ key, href: String(raw[key] || '').trim() }))
    .filter((item) => /^https?:\/\//i.test(item.href));
}

function legalPages(bundle: FooterBundle, host?: string | null) {
  const wanted = [
    { slug: 'privacy-policy', label: 'Privacy Policy' },
    { slug: 'privacy', label: 'Privacy Policy' },
    { slug: 'terms-of-use', label: 'Terms of Use' },
    { slug: 'terms', label: 'Terms of Use' },
    { slug: 'sitemap', label: 'Sitemap' },
  ];
  const seen = new Set<string>();
  const fromCms = wanted
    .filter((item) => bundle.pages.some((p) => p.slug === item.slug))
    .filter((item) => {
      if (seen.has(item.label)) return false;
      seen.add(item.label);
      return true;
    })
    .map((item) => ({ href: schoolWebPath(`/${item.slug}`, host), label: item.label }));
  if (!fromCms.some((item) => item.label === 'Privacy Policy')) {
    fromCms.unshift({
      href: schoolWebPath('/privacy-policy', host),
      label: 'Privacy Policy',
    });
  }
  return fromCms;
}

function ribbonIcon(title: string): 'book' | 'people' | 'cross' | 'pin' {
  const t = title.toLowerCase();
  if (t.includes('knowledge')) return 'book';
  if (t.includes('service')) return 'people';
  if (t.includes('light')) return 'cross';
  return 'pin';
}

export function SchoolSiteFooter({ bundle, host }: { bundle: FooterBundle; host?: string | null }) {
  const extrasJson = bundle.site.extrasJson ?? {};
  const about = bundle.homepage.find((s) => s.key === 'about')?.payload ?? {};
  const pillars = (bundle.homepage.find((s) => s.key === 'pillars')?.payload ?? {}) as {
    items?: Array<{ n: string; title: string; text?: string }>;
  };
  const contact = bundle.homepage.find((s) => s.key === 'contact')?.payload ?? {};
  const highlights = aboutHighlights(about, pillars).slice(0, 3);
  const scriptureQuote = String(extrasJson.scriptureQuote || '').trim();
  const scriptureAttribution = String(extrasJson.scriptureAttribution || '').trim();
  const blurb = String(
    extrasJson.footerBlurb || (Array.isArray(about.body) ? about.body[0] : '') || '',
  ).trim();
  const sign = String(extrasJson.footerSign || about.bandLine || '').trim();
  const newsletterIntro = String(
    extrasJson.newsletterIntro ||
      'Subscribe to receive the latest news, updates and event information from St. Luke’s.',
  ).trim();
  const officeHours = String(contact.officeHours || extrasJson.officeHours || '').trim();
  const contactNote = String(extrasJson.contactNote || '').trim();
  const logo = String(extrasJson.logoUrl || '/school-sis/st-lukes-logo.png');
  const address = [
    bundle.site.addressLine,
    [bundle.site.district, bundle.site.state].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join(', ');
  const mapQuery = String(
    contact.mapQuery ||
      `${bundle.site.displayName}, ${bundle.site.addressLine}, ${bundle.site.district}, ${bundle.site.state} ${bundle.site.pin}`,
  );
  const seo = seoBag(extrasJson);
  const directions = schoolMapsDirectionsUrl({
    query: mapQuery,
    mapsUrl: String(contact.mapsUrl || seo.googleMapsUrl || ST_LUKES_MAPS_URL),
    lat: String(contact.mapLat || seo.latitude || ST_LUKES_MAP_LAT),
    lng: String(contact.mapLng || seo.longitude || ST_LUKES_MAP_LNG),
  });
  const social = socialLinks(extrasJson);
  const footerItems = (bundle.menus.find((m) => m.location === 'FOOTER')?.items ?? []).filter(
    (i) => !i.parentId,
  );
  const quick = footerItems.some((i) => i.href === '/')
    ? footerItems
    : [
        { id: 'home', parentId: null, label: 'Home', href: '/', sortOrder: -1, visible: true },
        ...footerItems,
      ];
  const legal = legalPages(bundle, host);
  const year = new Date().getFullYear();
  const footerSettings = schoolFooterSettings(extrasJson);

  return (
    <footer className="sls-footer">
      <div className="sls-footer-values">
        <div className="sls-wrap sls-footer-values-inner">
          {highlights.length ? (
            <ul>
              {highlights.map((item) => (
                <li key={item.title}>
                  <span aria-hidden>
                    <FooterIcon name={ribbonIcon(item.title)} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    {item.text ? <em>{item.text}</em> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{bundle.site.motto.replace(/·/g, ' • ')}</p>
          )}
          {scriptureQuote ? (
            <blockquote>
              <p>“{scriptureQuote}”</p>
              {scriptureAttribution ? <cite>{scriptureAttribution}</cite> : null}
            </blockquote>
          ) : null}
        </div>
      </div>
      <div className="sls-footer-main">
        <div className="sls-footer-inner sls-footer-grid">
          <div className="sls-footer-brand">
            <a className="sls-footer-logo" href={schoolWebPath('/', host)}>
              <img src={logo} alt={`${bundle.site.displayName} emblem`} />
              <span>
                <strong>{bundle.site.displayName}</strong>
                <em>{bundle.site.motto.replace(/·/g, ' · ')}</em>
              </span>
            </a>
            {blurb ? <p>{blurb}</p> : null}
            {social.length || bundle.site.email ? (
              <ul className="sls-footer-social">
                {social.map((item) => (
                  <li key={item.key}>
                    <a href={item.href} target="_blank" rel="noreferrer" aria-label={item.key}>
                      <FooterIcon name={item.key} />
                    </a>
                  </li>
                ))}
                {bundle.site.email ? (
                  <li>
                    <a href={`mailto:${bundle.site.email}`} aria-label="Email">
                      <FooterIcon name="mail" />
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}
            {sign ? <p className="sls-footer-sign">{sign}</p> : null}
          </div>
          <div>
            <h3>Quick Links</h3>
            <ul className="sls-footer-links">
              {quick.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.href.startsWith('http') ? item.href : schoolWebPath(item.href, host)}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Contact Information</h3>
            <ul className="sls-footer-facts">
              <li>
                <FooterIcon name="pin" />
                <span>{address}</span>
              </li>
              {bundle.site.phone ? (
                <li>
                  <FooterIcon name="phone" />
                  <span>
                    <a href={`tel:${bundle.site.phone.replace(/\s+/g, '')}`}>{bundle.site.phone}</a>
                    <em>School office</em>
                  </span>
                </li>
              ) : null}
              {bundle.site.email ? (
                <li>
                  <FooterIcon name="mail" />
                  <span>
                    <a href={`mailto:${bundle.site.email}`}>{bundle.site.email}</a>
                  </span>
                </li>
              ) : null}
              {officeHours ? (
                <li>
                  <FooterIcon name="clock" />
                  <span>{officeHours}</span>
                </li>
              ) : null}
            </ul>
            {!bundle.site.phone && !bundle.site.email && contactNote ? (
              <p className="sls-footer-note">{contactNote}</p>
            ) : null}
            <a
              className="sls-btn sls-btn-ghost sls-footer-dir"
              href={directions}
              target="_blank"
              rel="noreferrer"
            >
              Get Directions <span aria-hidden>→</span>
            </a>
          </div>
          <div>
            <h3>Newsletter</h3>
            <SchoolFooterNewsletter intro={newsletterIntro} />
          </div>
        </div>
      </div>
      <div className="sls-footer-bar">
        <div className="sls-wrap sls-footer-bar-inner">
          <p>
            © {year} {bundle.site.displayName}. All rights reserved.
          </p>
          {footerSettings.visitorCounterEnabled ? (
            <SchoolFooterPresence label={footerSettings.visitorCounterLabel} />
          ) : null}
          <div className="sls-footer-bar-end">
            {legal.length ? (
              <p>
                {legal.map((item, i) => (
                  <span key={item.href}>
                    {i ? ' | ' : null}
                    <a href={item.href}>{item.label}</a>
                  </span>
                ))}
              </p>
            ) : null}
            {footerSettings.showDeveloperCredit ? (
              <p className="sls-footer-credit">
                {developerCredit(footerSettings.developerCreditText, footerSettings.developerUrl)}
              </p>
            ) : (
              <p className="sls-footer-bar-motto">{bundle.site.motto.replace(/·/g, ' · ')}</p>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

function developerCredit(text: string, url: string) {
  const name = 'BaseCode Labs Pvt. Ltd.';
  const idx = text.indexOf(name);
  const link = (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {idx >= 0 ? name : text}
    </a>
  );
  if (idx < 0) return link;
  return (
    <>
      {text.slice(0, idx)}
      {link}
      {text.slice(idx + name.length)}
    </>
  );
}

function FooterIcon({
  name,
}: {
  name:
    | 'pin'
    | 'phone'
    | 'mail'
    | 'clock'
    | 'book'
    | 'people'
    | 'cross'
    | 'facebook'
    | 'instagram'
    | 'youtube';
}) {
  const d: Record<string, string> = {
    pin: 'M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7zm0 9.5A2.5 2.5 0 1 0 9.5 9 2.5 2.5 0 0 0 12 11.5z',
    phone:
      'M6.5 3.5h3l1 4-2 1.5a12 12 0 0 0 6.5 6.5l1.5-2 4 1v3A2 2 0 0 1 19 19 16 16 0 0 1 5 5a2 2 0 0 1 1.5-1.5z',
    mail: 'M4 6h16v12H4zm0 0 8 6 8-6',
    clock: 'M12 3a9 9 0 1 1-9 9 9 9 0 0 1 9-9zm.8 4.2h-1.6v5.2l4 2.4.8-1.3-3.2-1.9z',
    book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4zm3 4h8v2H8zm0 4h8v2H8z',
    people:
      'M9 11a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm7-1a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM2 20v-1.2A5.8 5.8 0 0 1 7.8 13h2.4A5.8 5.8 0 0 1 16 18.8V20zm14-7h.8A4.8 4.8 0 0 1 22 17.8V20h-4v-1.8A7.7 7.7 0 0 0 16 13z',
    cross: 'M10 3h4v6h6v4h-6v8h-4v-8H4V9h6z',
    facebook: 'M14 9h3V6h-3c-2.2 0-4 1.8-4 4v3H7v3h3v6h3v-6h3l1-3h-4V10c0-.6.4-1 1-1z',
    instagram:
      'M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4zm4 4.5A3.5 3.5 0 1 0 15.5 12 3.5 3.5 0 0 0 12 8.5zM17.2 7a1 1 0 1 0 1 1 1 1 0 0 0-1-1z',
    youtube:
      'M22 12s0-3.2-.4-4.7a2.9 2.9 0 0 0-2-2C17.8 5 12 5 12 5s-5.8 0-7.6.3a2.9 2.9 0 0 0-2 2C2 8.8 2 12 2 12s0 3.2.4 4.7a2.9 2.9 0 0 0 2 2C6.2 19 12 19 12 19s5.8 0 7.6-.3a2.9 2.9 0 0 0 2-2C22 15.2 22 12 22 12zM10 15.5v-7l6 3.5z',
  };
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path fill="currentColor" d={d[name]} />
    </svg>
  );
}
