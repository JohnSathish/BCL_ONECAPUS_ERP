'use client';

import {
  Bell,
  BookOpen,
  CalendarDays,
  Cloud,
  CloudRain,
  GraduationCap,
  Library,
  MapPin,
  Megaphone,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import './noticeboard.css';

export type NoticeboardPayload = {
  banners: Array<{
    id: string;
    noticeId: string;
    title: string;
    category: string;
    priority: string;
    imageUrl: string;
    excerpt: string;
    publishAt: string | null;
    durationMs: number;
  }>;
  notices: Array<{
    id: string;
    title: string;
    excerpt: string;
    category: string;
    priority: string;
    publishAt: string | null;
    isNew: boolean;
    hasImage: boolean;
  }>;
  ticker: Array<{ id: string; text: string }>;
  events: Array<{
    id: string;
    title: string;
    date: string;
    endDate: string | null;
    category: string;
    description: string | null;
    startTime: string | null;
    endTime: string | null;
    venue: string | null;
    isAllDay: boolean;
  }>;
};

const CACHE_KEY = 'dbc-digital-noticeboard-v1';
const REFRESH_MS = 60_000;
const NOTICE_PAGE = 5;
const TURA = { latitude: 25.514, longitude: 90.2201 };

type Weather = { temperature: number; label: string };

function isPayload(value: unknown): value is NoticeboardPayload {
  if (!value || typeof value !== 'object') return false;
  const row = value as NoticeboardPayload;
  return (
    Array.isArray(row.banners) &&
    Array.isArray(row.notices) &&
    Array.isArray(row.ticker) &&
    Array.isArray(row.events)
  );
}

function readCache(): NoticeboardPayload | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function fetchNoticeboard(tenant?: string) {
  const query = tenant ? `?tenant=${encodeURIComponent(tenant)}` : '';
  const response = await fetch(`/api/v1/website/public/noticeboard${query}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Notice board request failed (${response.status})`);
  const payload = (await response.json()) as { success?: boolean; data?: unknown };
  const data = payload?.success === true && 'data' in payload ? payload.data : payload;
  if (!isPayload(data)) throw new Error('Notice board response was not recognised');
  return data;
}

function labelize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function categoryIcon(category: string): LucideIcon {
  const key = category.toUpperCase();
  if (key.includes('EXAM')) return GraduationCap;
  if (key.includes('ADMISSION') || key.includes('RECRUIT')) return Users;
  if (key.includes('LIBRARY') || key.includes('BOOK')) return Library;
  if (key.includes('HOLIDAY') || key.includes('BREAK')) return CalendarDays;
  if (key.includes('ACADEMIC') || key.includes('ROUTINE') || key.includes('SEMINAR'))
    return BookOpen;
  if (key.includes('FEE')) return Bell;
  return Megaphone;
}

function formatPublished(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function eventParts(date: string) {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return { day: '--', month: '---' };
  const utc = new Date(Date.UTC(year, month - 1, day));
  return {
    day: String(day).padStart(2, '0'),
    month: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
      .format(utc)
      .toUpperCase(),
  };
}

function formatClockTime(value: string | null) {
  if (!value) return null;
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

function eventWhen(event: NoticeboardPayload['events'][number]) {
  if (event.isAllDay || !event.startTime) return null;
  const start = formatClockTime(event.startTime);
  const end = formatClockTime(event.endTime);
  if (!start) return null;
  return end ? `${start} – ${end}` : start;
}

function weatherLabel(code: number) {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 67 || (code >= 80 && code <= 82)) return 'Rain';
  if (code <= 86) return 'Snow';
  return 'Storm';
}

function WeatherIcon({ label }: { label: string }) {
  if (label === 'Clear') return <Sun aria-hidden="true" />;
  if (label === 'Rain' || label === 'Storm') return <CloudRain aria-hidden="true" />;
  return <Cloud aria-hidden="true" />;
}

export function DigitalNoticeBoard({
  initial,
  tenant,
}: {
  initial: NoticeboardPayload | null;
  tenant?: string;
}) {
  const [data, setData] = useState<NoticeboardPayload | null>(initial);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [noticeStart, setNoticeStart] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    if (data) return;
    const cached = readCache();
    if (cached) setData(cached);
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const next = await fetchNoticeboard(tenant);
        if (cancelled) return;
        setData(next);
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      } catch {
        if (!cancelled) {
          setData((current) => current ?? readCache());
        }
      }
    };
    void pull();
    const timer = window.setInterval(() => void pull(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tenant]);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', String(TURA.latitude));
        url.searchParams.set('longitude', String(TURA.longitude));
        url.searchParams.set('current', 'temperature_2m,weather_code');
        url.searchParams.set('timezone', 'Asia/Kolkata');
        const response = await fetch(url);
        if (!response.ok) return;
        const payload = (await response.json()) as {
          current?: { temperature_2m?: number; weather_code?: number };
        };
        const temperature = payload.current?.temperature_2m;
        const code = payload.current?.weather_code;
        if (cancelled || typeof temperature !== 'number' || typeof code !== 'number') return;
        setWeather({ temperature: Math.round(temperature), label: weatherLabel(code) });
      } catch {
        /* The clock stays visible when weather is unavailable. */
      }
    };
    void pull();
    const timer = window.setInterval(() => void pull(), 30 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const banners = data?.banners ?? [];
  const notices = data?.notices ?? [];
  const events = (data?.events ?? []).slice(0, 3);
  const ticker = data?.ticker ?? [];
  const banner = banners[bannerIndex] ?? banners[0] ?? null;

  useEffect(() => {
    if (bannerIndex < banners.length) return;
    setBannerIndex(0);
  }, [bannerIndex, banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const duration = banners[bannerIndex]?.durationMs ?? 12_000;
    const timer = window.setTimeout(() => {
      setBannerIndex((current) => (current + 1) % banners.length);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [banners, bannerIndex]);

  useEffect(() => {
    if (notices.length <= NOTICE_PAGE) return;
    const timer = window.setInterval(() => {
      setNoticeStart((current) => (current + 1) % notices.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [notices.length]);

  const visibleNotices = useMemo(() => {
    if (notices.length <= NOTICE_PAGE) return notices;
    return Array.from(
      { length: NOTICE_PAGE },
      (_, offset) => notices[(noticeStart + offset) % notices.length],
    );
  }, [notices, noticeStart]);

  const clockDate = now
    ? new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(now)
    : '';
  const clockTime = now
    ? new Intl.DateTimeFormat('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      }).format(now)
    : '';

  const tickerLoop = ticker.length ? [...ticker, ...ticker] : [];
  const tickerSeconds = Math.max(
    18,
    ticker.reduce((sum, item) => sum + item.text.length, 0) * 0.12,
  );

  return (
    <div className="nb" data-kiosk="dbc-noticeboard">
      <header className="nb-header">
        <div className="nb-brand">
          <img src="/images/college-logo.png" alt="" />
          <div>
            <strong>Don Bosco College, Tura</strong>
            <em>In Pursuit of Excellence</em>
            <span>Affiliated to North-Eastern Hill University (NEHU)</span>
          </div>
        </div>
        <div className="nb-clock">
          <p>{clockDate}</p>
          <strong>{clockTime}</strong>
          {weather ? (
            <span>
              <WeatherIcon label={weather.label} />
              {weather.temperature}°C
              <small>{weather.label} · Tura</small>
            </span>
          ) : (
            <span>Tura</span>
          )}
        </div>
      </header>

      <main className="nb-main">
        <section className="nb-stage" aria-label="Notice images">
          {!data ? (
            <div className="nb-empty">
              <div className="nb-empty-card">
                <img src="/images/college-logo.png" alt="" />
                <h2>Connecting to the notice board</h2>
              </div>
            </div>
          ) : banner ? (
            <article className="nb-banner" key={banner.id}>
              <img src={banner.imageUrl} alt="" />
            </article>
          ) : (
            <div className="nb-empty">
              <div className="nb-empty-card">
                <img src="/images/college-logo.png" alt="" />
                <h2>Campus notice board</h2>
                <p>Upload a JPG, PNG, or WebP in Website CMS → Image Notices.</p>
              </div>
            </div>
          )}
          {banners.length > 1 ? (
            <div className="nb-dots" aria-hidden="true">
              {banners.map((item, index) => (
                <i key={item.id} className={index === bannerIndex ? 'is-active' : undefined} />
              ))}
            </div>
          ) : null}
        </section>

        <section className="nb-list" aria-label="Notices and announcements">
          <header>
            <Bell aria-hidden="true" />
            <h2>Notices / Announcements</h2>
          </header>
          {visibleNotices.length ? (
            <ul>
              {visibleNotices.map((notice) => {
                const Icon = categoryIcon(notice.category);
                return (
                  <li key={notice.id}>
                    <span className={`nb-icon nb-icon-${notice.priority.toLowerCase()}`}>
                      <Icon aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{notice.title}</strong>
                      {notice.excerpt ? <p>{notice.excerpt}</p> : null}
                    </div>
                    <aside>
                      {notice.priority === 'URGENT' || notice.priority === 'IMPORTANT' ? (
                        <b className={`nb-pill nb-pill-${notice.priority.toLowerCase()}`}>
                          {labelize(notice.priority)}
                        </b>
                      ) : notice.isNew ? (
                        <b className="nb-pill nb-pill-new">New</b>
                      ) : null}
                      <time dateTime={notice.publishAt ?? undefined}>
                        {formatPublished(notice.publishAt)}
                      </time>
                    </aside>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="nb-list-empty">
              <Bell aria-hidden="true" />
              <p>{data ? 'Notices will appear here as they are published.' : 'Connecting…'}</p>
            </div>
          )}
        </section>
      </main>

      <section className="nb-events" aria-label="Upcoming events">
        <header>
          <CalendarDays aria-hidden="true" />
          <h2>Upcoming Events</h2>
        </header>
        {events.length ? (
          <ol>
            {events.map((event) => {
              const when = eventParts(event.date);
              const time = eventWhen(event);
              return (
                <li key={event.id}>
                  <span>
                    <small>{when.month}</small>
                    <strong>{when.day}</strong>
                  </span>
                  <div>
                    <b>{labelize(event.category)}</b>
                    <h3>{event.title}</h3>
                    {time || event.venue ? (
                      <p>
                        {time}
                        {time && event.venue ? ' · ' : null}
                        {event.venue ? (
                          <>
                            <MapPin aria-hidden="true" />
                            {event.venue}
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="nb-events-empty">
            <CalendarDays aria-hidden="true" />
            <p>
              {data
                ? 'Upcoming events from the academic calendar will be listed here.'
                : 'Connecting to the academic calendar…'}
            </p>
          </div>
        )}
      </section>

      <footer className="nb-ticker">
        <strong>Announcements</strong>
        <div>
          {tickerLoop.length ? (
            <p style={{ animationDuration: `${tickerSeconds}s` }}>
              {tickerLoop.map((item, index) => (
                <span key={`${item.id}-${index}`}>{item.text}</span>
              ))}
            </p>
          ) : (
            <p className="nb-ticker-hold">
              <span>
                Published notices and academic calendar events appear here as they are updated.
              </span>
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
