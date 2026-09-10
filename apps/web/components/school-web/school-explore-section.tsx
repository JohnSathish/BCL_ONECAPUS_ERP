import { schoolWebPath } from '@/lib/school-web/paths';

export type SchoolExploreCard = {
  enabled?: boolean;
  featured?: boolean;
  icon?: string;
  iconUrl?: string;
  imageUrl?: string;
  kicker?: string;
  title: string;
  body?: string;
  href: string;
  cta?: string;
  target?: '_self' | '_blank';
};

export type SchoolExploreFooterItem = {
  icon?: string;
  title: string;
  text?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const DEFAULT_IMAGES: Record<string, string> = {
  '/academics': '/school-sis/explore/academics.jpg',
  '/notices': '/school-sis/explore/notices.jpg',
  '/student-life': '/school-sis/explore/campus.jpg',
  '/campus-life': '/school-sis/explore/campus.jpg',
  '/facilities': '/school-sis/explore/facilities-campus.jpg',
  '/apply': '/school-sis/explore/admissions.jpg',
  '/admissions': '/school-sis/explore/admissions.jpg',
};

const DEFAULT_ICON_TONE: Record<string, string> = {
  cap: 'gold',
  bell: 'gold',
  people: 'green',
  building: 'navy',
  book: 'navy',
  apply: 'rose',
  parents: 'green',
};

export function parseExploreCards(payload: Record<string, unknown>): SchoolExploreCard[] {
  const rows = Array.isArray(payload.cards) ? payload.cards : [];
  return rows
    .map((raw) => {
      const item = asRecord(raw);
      const title = String(item.title || '').trim();
      const href = String(item.href || '').trim();
      if (!title || !href) return null;
      if (item.enabled === false) return null;
      if (/parent-corner/i.test(href) || /parent corner/i.test(title)) return null;
      const icon =
        href === '/facilities' && (!item.icon || item.icon === 'book')
          ? 'building'
          : item.icon
            ? String(item.icon)
            : undefined;
      return {
        enabled: true,
        featured: Boolean(item.featured),
        icon,
        iconUrl: item.iconUrl ? String(item.iconUrl) : undefined,
        imageUrl: item.imageUrl ? String(item.imageUrl) : DEFAULT_IMAGES[href],
        kicker: item.kicker ? String(item.kicker) : undefined,
        title,
        body: item.body ? String(item.body) : undefined,
        href,
        cta: item.cta ? String(item.cta) : undefined,
        target: item.target === '_blank' ? '_blank' : '_self',
      } satisfies SchoolExploreCard;
    })
    .filter((row): row is SchoolExploreCard => Boolean(row));
}

export function parseExploreFooter(payload: Record<string, unknown>): SchoolExploreFooterItem[] {
  const rows = Array.isArray(payload.footerItems) ? payload.footerItems : [];
  return rows
    .map((raw) => {
      const item = asRecord(raw);
      const title = String(item.title || '').trim();
      if (!title) return null;
      return {
        icon: item.icon ? String(item.icon) : undefined,
        title,
        text: item.text ? String(item.text) : undefined,
      };
    })
    .filter((row): row is SchoolExploreFooterItem => Boolean(row));
}

export function SchoolExploreSection({
  payload,
  motto,
  host,
}: {
  payload: Record<string, unknown>;
  motto?: string;
  host?: string | null;
}) {
  const cards = parseExploreCards(payload);
  if (!cards.length) return null;
  const kicker = String(payload.kicker || "EXPLORE ST. LUKE'S");
  const title = String(payload.title || '');
  const intro = String(payload.intro || '');
  const footer = parseExploreFooter(payload);

  return (
    <section className="sls-explore" aria-labelledby="sls-explore-heading">
      <div className="sls-explore-bg" aria-hidden>
        {motto ? <span className="sls-explore-watermark">{motto.replace(/·/g, ' ')}</span> : null}
      </div>
      <div className="sls-wrap">
        <header className="sls-explore-head">
          <p className="sls-kicker sls-explore-kicker">{kicker}</p>
          {title ? (
            <h2 id="sls-explore-heading">{title}</h2>
          ) : (
            <h2 id="sls-explore-heading">{kicker}</h2>
          )}
          {intro ? <p className="sls-muted">{intro}</p> : null}
        </header>
        <div className="sls-explore-grid">
          {cards.map((card) => {
            const photo = card.imageUrl || DEFAULT_IMAGES[card.href];
            const tone = DEFAULT_ICON_TONE[card.icon || ''] || 'navy';
            return (
              <a
                key={`${card.href}-${card.title}`}
                className={`sls-explore-card${card.featured ? ' is-featured' : ''}`}
                href={schoolWebPath(card.href, host)}
                target={card.target === '_blank' ? '_blank' : undefined}
                rel={card.target === '_blank' ? 'noreferrer' : undefined}
              >
                <span className="sls-explore-photo">
                  {photo ? (
                    <img src={photo} alt="" loading="lazy" />
                  ) : (
                    <span className="sls-explore-photo-fallback" />
                  )}
                  {card.featured ? <span className="sls-explore-badge">Featured</span> : null}
                </span>
                <span className={`sls-explore-icon sls-explore-icon--${tone}`} aria-hidden>
                  {card.iconUrl ? (
                    <img src={card.iconUrl} alt="" />
                  ) : (
                    <ExploreGlyph name={card.icon || 'book'} />
                  )}
                </span>
                <span className="sls-explore-copy">
                  {card.kicker ? <span className="sls-explore-cat">{card.kicker}</span> : null}
                  <h3>{card.title}</h3>
                  {card.body ? <p>{card.body}</p> : null}
                  <span className={`sls-explore-cta${card.featured ? ' is-btn' : ''}`}>
                    {card.cta || `Explore ${card.title}`} <span aria-hidden>→</span>
                  </span>
                </span>
              </a>
            );
          })}
        </div>
        {footer.length ? (
          <ul className="sls-explore-foot">
            {footer.map((item) => (
              <li key={item.title}>
                <span className="sls-explore-foot-icon" aria-hidden>
                  <ExploreGlyph name={item.icon || 'book'} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  {item.text ? <em>{item.text}</em> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function ExploreGlyph({ name }: { name: string }) {
  const d =
    {
      book: 'M6 4h9a3 3 0 0 1 3 3v13H8a2 2 0 0 1-2-2V4zm2 2v14h8V7a1 1 0 0 0-1-1H8z',
      cap: 'M3 10.5 12 6l9 4.5-9 4.5L3 10.5zm3.5 3.2v3.3c0 .8 2.4 2 5.5 2s5.5-1.2 5.5-2v-3.3L12 16.3 6.5 13.7z',
      bell: 'M12 3a6 6 0 0 1 6 6v3.2l1.4 2.1H4.6L6 12.2V9a6 6 0 0 1 6-6zm-2.2 14.5a2.2 2.2 0 0 0 4.4 0z',
      people:
        'M9 11a3.2 3.2 0 1 0-3.2-3.2A3.2 3.2 0 0 0 9 11zm9.2-.4A2.9 2.9 0 1 0 16 7.7a2.9 2.9 0 0 0 2.2 2.9zM3.4 19A5.1 5.1 0 0 1 14 19zm8.4-1.6A4.4 4.4 0 0 1 21 19h-2.2a4.3 4.3 0 0 0-5.2-2.5z',
      parents:
        'M8.5 11A3 3 0 1 0 5.5 8 3 3 0 0 0 8.5 11zm7 0A3 3 0 1 0 12.5 8 3 3 0 0 0 15.5 11zM3 19a5 5 0 0 1 11 0zm7.2 0A5 5 0 0 1 21 19z',
      apply: 'M7 3h8l4 4v14H7zm8 1.5V8h3.5zM9 12h8v1.4H9zm0 3h8v1.4H9z',
      building: 'M4 20V8l8-4 8 4v12h-5v-6H9v6H4zm7 0h2v-4h-2v4z',
      sprout: 'M12 3c2.4 3 4 5.2 4 7.4A4 4 0 0 1 8 10.4C8 8.2 9.6 6 12 3zm-1 11h2v7h-2z',
    }[name] || 'M6 4h9a3 3 0 0 1 3 3v13H8a2 2 0 0 1-2-2V4zm2 2v14h8V7a1 1 0 0 0-1-1H8z';
  return (
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path fill="currentColor" d={d} />
    </svg>
  );
}
