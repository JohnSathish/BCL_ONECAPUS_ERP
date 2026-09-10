import { schoolWebPath } from '@/lib/school-web/paths';
import type { SchoolWebBundle } from '@/lib/school-web/public';

function excerpt(text: string, max = 140) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function eventParts(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' }),
    month: d
      .toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })
      .toUpperCase(),
    time: d.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }),
    dateOnly: d.getHours() === 0 && d.getMinutes() === 0,
  };
}

function categoryTone(category: string) {
  const key = category.toUpperCase();
  if (key.includes('ACADEMIC')) return 'academic';
  if (key.includes('EVENT')) return 'event';
  if (key.includes('NOTICE')) return 'notice';
  return 'general';
}

export function SchoolNewsEventsSection({
  payload,
  notices,
  events,
  displayName,
  host,
}: {
  payload: Record<string, unknown>;
  notices: SchoolWebBundle['notices'];
  events: SchoolWebBundle['events'];
  displayName: string;
  host?: string | null;
}) {
  const noticeLimit = Math.max(1, Number(payload.noticeLimit || 3));
  const eventLimit = Math.max(1, Number(payload.eventLimit || 3));
  const listedNotices = [...notices]
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime(),
    )
    .slice(0, noticeLimit);
  const upcoming = events
    .filter((e) => new Date(e.startsAt).getTime() >= Date.now())
    .slice(0, eventLimit);
  const kicker = String(payload.kicker || 'NEWS & NOTICES');
  const title = String(payload.title || 'Latest Announcements');
  const intro = String(payload.intro || '');
  const noticesCta = String(payload.noticesCta || 'View All Notices');
  const noticesHref = String(payload.noticesHref || '/notices');
  const eventsKicker = String(payload.eventsKicker || 'UPCOMING EVENTS');
  const eventsTitle = String(payload.eventsTitle || 'Upcoming');
  const eventsIntro = String(
    payload.eventsIntro || 'Upcoming events will appear when the office publishes them.',
  );
  const eventsCta = String(payload.eventsCta || 'View All Events');
  const eventsHref = String(payload.eventsHref || '/events');
  const panelImage = String(payload.panelImageUrl || '').trim();
  const panelImageAlt = String(payload.panelImageAlt || displayName);

  return (
    <section className="sls-news" aria-labelledby="sls-news-heading">
      <div className="sls-news-bg" aria-hidden />
      <div className="sls-wrap sls-news-grid">
        <div className="sls-news-col">
          <header className="sls-news-head">
            <p className="sls-kicker sls-kicker-line">{kicker}</p>
            <h2 id="sls-news-heading">{title}</h2>
            {intro ? <p className="sls-muted">{intro}</p> : null}
          </header>
          {listedNotices.length ? (
            <ul className="sls-news-list">
              {listedNotices.map((notice) => (
                <li key={notice.id}>
                  <a
                    className={`sls-news-card is-${categoryTone(notice.category)}${notice.featured ? ' is-featured' : ''}`}
                    href={schoolWebPath(`/notices/${notice.slug}`, host)}
                  >
                    <span className="sls-news-icon" aria-hidden>
                      <NewsGlyph category={notice.category} />
                    </span>
                    <span className="sls-news-copy">
                      <span className="sls-news-cat">
                        {notice.featured ? 'Featured · ' : ''}
                        {notice.category}
                      </span>
                      <strong>{notice.title}</strong>
                      <span>{excerpt(notice.body)}</span>
                    </span>
                    <span className="sls-news-meta">
                      {notice.publishedAt ? (
                        <time dateTime={notice.publishedAt}>{formatDate(notice.publishedAt)}</time>
                      ) : null}
                      <span className="sls-news-arrow" aria-hidden>
                        →
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sls-news-empty">
              No published notices yet. Announcements will appear here when the office publishes
              them.
            </p>
          )}
          <a className="sls-news-all" href={schoolWebPath(noticesHref, host)}>
            {noticesCta} <span aria-hidden>→</span>
          </a>
        </div>
        <aside className="sls-events-panel" aria-labelledby="sls-events-heading">
          <header className="sls-news-head">
            <p className="sls-kicker sls-kicker-line">{eventsKicker}</p>
            <h2 id="sls-events-heading">{eventsTitle}</h2>
            {eventsIntro ? <p className="sls-muted">{eventsIntro}</p> : null}
          </header>
          {upcoming.length ? (
            <ul className="sls-events-list">
              {upcoming.map((event) => {
                const parts = eventParts(event.startsAt);
                const end = event.endsAt ? eventParts(event.endsAt) : null;
                return (
                  <li key={event.id}>
                    <a
                      className="sls-event-row"
                      href={schoolWebPath(`/events/${event.slug}`, host)}
                    >
                      <span className="sls-event-date">
                        <strong>{parts.day}</strong>
                        <em>{parts.month}</em>
                      </span>
                      <span className="sls-event-copy">
                        <strong>{event.title}</strong>
                        {event.venue ? <span>{event.venue}</span> : null}
                        {!parts.dateOnly || (end && !end.dateOnly) ? (
                          <span>
                            {parts.dateOnly ? '' : parts.time}
                            {end && !end.dateOnly ? ` – ${end.time}` : ''}
                          </span>
                        ) : null}
                      </span>
                      <span className="sls-news-arrow" aria-hidden>
                        →
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="sls-news-empty">
              {String(
                payload.eventsEmpty ||
                  'No upcoming events. Upcoming events will appear here when the school publishes them.',
              )}
            </p>
          )}
          {panelImage ? (
            <figure className="sls-events-photo">
              <img src={panelImage} alt={panelImageAlt} loading="lazy" />
            </figure>
          ) : null}
          <a className="sls-btn sls-btn-navy" href={schoolWebPath(eventsHref, host)}>
            {eventsCta} <span aria-hidden>→</span>
          </a>
        </aside>
      </div>
    </section>
  );
}

function NewsGlyph({ category }: { category: string }) {
  const tone = categoryTone(category);
  const d =
    tone === 'academic'
      ? 'M3 10.5 12 6l9 4.5-9 4.5L3 10.5zm3.5 3.2v3.3c0 .8 2.4 2 5.5 2s5.5-1.2 5.5-2v-3.3L12 16.3 6.5 13.7z'
      : tone === 'event'
        ? 'M7 3h2v2h6V3h2v2h3v16H4V5h3zm-1 6h12v10H6z'
        : tone === 'notice'
          ? 'M12 3a6 6 0 0 1 6 6v3.2l1.4 2.1H4.6L6 12.2V9a6 6 0 0 1 6-6zm-2.2 14.5a2.2 2.2 0 0 0 4.4 0z'
          : 'M5 8.5 12 4l7 4.5V19H5zm2 2v6.5h10V10.5L12 8z';
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path fill="currentColor" d={d} />
    </svg>
  );
}
