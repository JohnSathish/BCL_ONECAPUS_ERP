'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin } from 'lucide-react';
import { AlumniPublicShell } from '@/components/alumni-portal/alumni-public-shell';
import { fetchAlumniEvents, fetchAlumniPortalInfo } from '@/services/alumni-portal';

export default function AlumniEventsPage() {
  const infoQ = useQuery({ queryKey: ['alumni-portal-info'], queryFn: fetchAlumniPortalInfo });
  const eventsQ = useQuery({ queryKey: ['alumni-portal-events'], queryFn: fetchAlumniEvents });
  const events = eventsQ.data ?? [];
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.startsAt).getTime() >= now);
  const past = events.filter((e) => new Date(e.startsAt).getTime() < now).reverse();

  return (
    <AlumniPublicShell associationName={infoQ.data?.settings.associationName}>
      <section className="relative overflow-hidden border-b border-[#1a2b47]/10 bg-[#1a2b47]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(243,182,59,0.18),_transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f3b63b]">
            Alumni calendar
          </p>
          <h1 className="mt-2 font-serif text-4xl text-white">Events</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
            Reunions, meetings, webinars, and department gatherings — stay connected with the
            Bosconian family.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
        {eventsQ.isLoading ? <p className="text-sm text-[#1a2b47]/65">Loading events…</p> : null}

        {!eventsQ.isLoading && events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1a2b47]/20 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1a2b47]/5 text-[#f3b63b]">
              <CalendarDays className="h-7 w-7" />
            </div>
            <h2 className="mt-4 font-serif text-2xl text-[#1a2b47]">No events published yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#1a2b47]/70">
              The Alumni Office will publish reunions and meetings here. Meanwhile, you can join as
              a member and watch this space.
            </p>
            <Link
              href="/alumni-portal/register"
              className="mt-6 inline-flex rounded-md bg-[#f3b63b] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[#1a2b47]"
            >
              Become a Member
            </Link>
          </div>
        ) : null}

        {upcoming.length > 0 ? (
          <section className="mb-12">
            <h2 className="font-serif text-2xl text-[#1a2b47]">Upcoming</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {upcoming.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </section>
        ) : null}

        {past.length > 0 ? (
          <section>
            <h2 className="font-serif text-2xl text-[#1a2b47]">Past highlights</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {past.map((e) => (
                <EventCard key={e.id} event={e} muted />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AlumniPublicShell>
  );
}

function EventCard({
  event,
  muted,
}: {
  event: {
    id: string;
    title: string;
    summary: string | null;
    startsAt: string;
    venue: string | null;
    eventType?: string;
  };
  muted?: boolean;
}) {
  const d = new Date(event.startsAt);
  const day = d.toLocaleDateString('en-IN', { day: '2-digit' });
  const month = d.toLocaleDateString('en-IN', { month: 'short' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
        muted ? 'border-[#1a2b47]/10 opacity-90' : 'border-[#1a2b47]/12'
      }`}
    >
      <div className="flex gap-4 p-5">
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-[#1a2b47] text-center text-white">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#f3b63b]">
            {month}
          </span>
          <span className="text-xl font-semibold leading-none">{day}</span>
        </div>
        <div className="min-w-0 flex-1">
          {event.eventType ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#f3b63b]">
              {event.eventType.replace(/_/g, ' ')}
            </p>
          ) : null}
          <h3 className="mt-0.5 font-serif text-xl text-[#1a2b47]">{event.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#1a2b47]/65">
            <span>{time}</span>
            {event.venue ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {event.venue}
              </span>
            ) : null}
          </p>
          {event.summary ? (
            <p className="mt-3 text-sm leading-relaxed text-[#1a2b47]/75">{event.summary}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
