'use client';

import Link from 'next/link';
import { ArrowRight, Bell, CalendarDays, Compass, Download, Eye } from 'lucide-react';
import { AutoScrollTicker } from '@/components/auto-scroll-ticker';
import {
  daysUntil,
  eventCategoryStyles,
  eventDateParts,
  isRecentNotice,
  isSameDay,
  noticeBadgeStyles,
  type HubEvent,
  type HubNotice,
  type InformationHubContent,
} from '@/lib/information-hub';

type Props = {
  hub: InformationHubContent;
  mode?: 'events' | 'notices' | 'both';
};

const COLLEGE_VISION =
  'Inspired by the benign and noble teachings of the Lord Jesus Christ who said, “I am the Way, the Truth and the Life,” and guided by the educational philosophy of St. John Bosco, the college has the avowed vision of bringing holistic, quality higher education within the reach of all.';

const COLLEGE_MISSION =
  'To provide an education that is participatory in nature, intellectual competence, multi-skill oriented, value based and socially committed for the development of persons and enrichment of society.';

function EventRow({ event, highlightToday }: { event: HubEvent; highlightToday?: boolean }) {
  const { day, month, weekday } = eventDateParts(event.date);
  const style = eventCategoryStyles[event.category];
  const remaining = Math.max(0, daysUntil(event.date));
  const happeningToday = highlightToday || isSameDay(event.date);
  const content = (
    <>
      <time
        className={`info-event-date${happeningToday ? ' is-today' : ''}`}
        dateTime={event.date}
        aria-label={new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'full' })}
      >
        <span className="info-event-date-month">{month}</span>
        <span className="info-event-date-body">
          <strong>{day}</strong>
          <small>{weekday}</small>
        </span>
      </time>
      <span className="info-event-copy">
        <span className="info-badge" style={{ background: style.bg, color: style.color }}>
          {event.category}
        </span>
        <strong>{event.title}</strong>
        <em>
          {happeningToday
            ? 'Happening today'
            : `Starts in ${remaining} ${remaining === 1 ? 'day' : 'days'}`}
        </em>
      </span>
    </>
  );

  return event.href ? (
    <Link href={event.href} className={`info-event-row${happeningToday ? ' is-today' : ''}`}>
      {content}
    </Link>
  ) : (
    <div className={`info-event-row${happeningToday ? ' is-today' : ''}`}>{content}</div>
  );
}

function NoticeRow({ notice, noticesHref }: { notice: HubNotice; noticesHref: string }) {
  const badge = notice.urgent ? 'URGENT' : notice.badge;
  const style = noticeBadgeStyles[badge];
  const published = new Date(notice.publishedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const pulseNew = notice.badge === 'NEW' && isRecentNotice(notice.publishedAt);

  return (
    <Link
      href={notice.href ?? noticesHref}
      className={`info-notice-item${notice.urgent ? ' is-urgent' : ''}${pulseNew ? ' is-new' : ''}`}
    >
      <span
        className={`info-badge${pulseNew ? ' is-pulse' : ''}`}
        style={{ background: style.bg, color: style.color }}
      >
        {badge}
      </span>
      <span className="info-notice-copy">
        <strong>{notice.title}</strong>
        <small>{published}</small>
      </span>
      {notice.attachmentHref ? (
        <span className="info-download" aria-label="Has attachment">
          <Download aria-hidden />
        </span>
      ) : (
        <span className="info-download-spacer" aria-hidden />
      )}
    </Link>
  );
}

function EventsCard({ hub }: { hub: InformationHubContent }) {
  const sortedEvents = [...hub.upcomingEvents]
    .filter((event) => daysUntil(event.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const todayEvents = sortedEvents.filter((event) => isSameDay(event.date));
  const scrollEvents = (
    sortedEvents.filter((event) => !isSameDay(event.date)).length
      ? sortedEvents.filter((event) => !isSameDay(event.date))
      : sortedEvents
  ).slice(0, 5);

  return (
    <article className="info-card info-card-events info-card-tall">
      <div className="info-card-inner">
        <header className="info-card-head">
          <h2>
            <CalendarDays aria-hidden /> Upcoming Events
          </h2>
          <Link className="info-view-all" href={hub.calendarHref}>
            View all <ArrowRight aria-hidden />
          </Link>
        </header>

        {todayEvents.length ? (
          <div className="info-pinned">
            {todayEvents.map((event) => (
              <EventRow key={`today-${event.id}`} event={event} highlightToday />
            ))}
          </div>
        ) : null}

        <AutoScrollTicker label="Upcoming events ticker" speedPx={26}>
          {scrollEvents.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </AutoScrollTicker>
      </div>
      <footer className="info-card-foot info-card-foot-navy">
        <Link href={hub.calendarHref}>
          View academic calendar <ArrowRight aria-hidden />
        </Link>
      </footer>
    </article>
  );
}

function NoticesCard({ hub }: { hub: InformationHubContent }) {
  const sortedNotices = [...hub.notices].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const urgentNotices = sortedNotices
    .filter((notice) => notice.urgent || notice.badge === 'URGENT')
    .slice(0, 1);
  const scrollNotices = sortedNotices
    .filter((notice) => !(notice.urgent || notice.badge === 'URGENT'))
    .slice(0, 5);

  return (
    <article className="info-card info-card-notices">
      <div className="info-card-inner">
        <header className="info-card-head">
          <h2>
            <Bell aria-hidden /> Notice Board
          </h2>
          <Link className="info-view-all" href={hub.noticesHref}>
            View all <ArrowRight aria-hidden />
          </Link>
        </header>

        {urgentNotices.length ? (
          <div className="info-pinned">
            {urgentNotices.map((notice) => (
              <NoticeRow
                key={`urgent-${notice.id}`}
                notice={notice}
                noticesHref={hub.noticesHref}
              />
            ))}
          </div>
        ) : null}

        <AutoScrollTicker label="Notice board ticker" speedPx={24}>
          {scrollNotices.map((notice) => (
            <NoticeRow key={notice.id} notice={notice} noticesHref={hub.noticesHref} />
          ))}
        </AutoScrollTicker>
      </div>
      <footer className="info-card-foot info-card-foot-navy">
        <Link href={hub.noticesHref}>
          View all notices <ArrowRight aria-hidden />
        </Link>
      </footer>
    </article>
  );
}

function StatementCard({
  title,
  icon: Icon,
  text,
  href,
  tone,
}: {
  title: string;
  icon: typeof Eye;
  text: string;
  href: string;
  tone: 'vision' | 'mission';
}) {
  return (
    <article className={`info-card info-card-statement info-card-${tone}`}>
      <div className="info-card-inner">
        <header className="info-card-head">
          <h2>
            <Icon aria-hidden /> {title}
          </h2>
        </header>
        <div className="info-statement-body">
          <span className="info-statement-mark" aria-hidden>
            “
          </span>
          <p>{text}</p>
        </div>
      </div>
      <footer className="info-card-foot info-card-foot-light">
        <Link href={href}>
          Read more <ArrowRight aria-hidden />
        </Link>
      </footer>
    </article>
  );
}

export function InformationHub({ hub, mode = 'both' }: Props) {
  if (mode === 'events') return <EventsCard hub={hub} />;
  if (mode === 'notices') {
    return (
      <section className="info-hub info-hub-notices" aria-label="Notice board, vision and mission">
        <div className="shell info-hub-grid">
          <NoticesCard hub={hub} />
          <StatementCard
            title="Vision"
            icon={Eye}
            tone="vision"
            text={COLLEGE_VISION}
            href="/about/vision-mission"
          />
          <StatementCard
            title="Mission"
            icon={Compass}
            tone="mission"
            text={COLLEGE_MISSION}
            href="/about/vision-mission"
          />
        </div>
      </section>
    );
  }

  return (
    <section className="info-hub" aria-label="Upcoming events and notice board">
      <div className="shell info-hub-grid info-hub-grid-two">
        <EventsCard hub={hub} />
        <NoticesCard hub={hub} />
      </div>
    </section>
  );
}
