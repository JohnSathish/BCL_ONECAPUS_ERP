import type { Metadata } from 'next';
import Link from 'next/link';
import { WorkingCalendar } from '@/components/working-calendar';
import { getPublicAcademicPlanner } from '@/lib/academic-planner';

export const metadata: Metadata = {
  title: 'Academic Calendar',
  description:
    'Handbook-style academic year planner for Don Bosco College, Tura — monthly Class days, events, and working-day totals.',
};

type Props = {
  searchParams?: Promise<{ month?: string }>;
};

export default async function AcademicCalendarPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const planner = await getPublicAcademicPlanner();
  const months = planner?.months ?? [];
  const requested = typeof params.month === 'string' ? params.month : '';
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const active =
    months.find((month) => month.key === requested) ??
    months.find((month) => month.key === currentMonthKey) ??
    months[0] ??
    null;

  return (
    <main id="main" className="academic-calendar-page">
      <header className="inner-hero">
        <div className="shell">
          <div className="breadcrumbs">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/academics/programmes">Academics</Link>
            <span>/</span>
            <span>Academic Calendar</span>
          </div>
          <span className="eyebrow gold">Year planner</span>
          <h1>{planner?.title ?? 'Academic Calendar'}</h1>
          <p>
            {planner
              ? `${planner.startDate} to ${planner.endDate} · synced from the ERP Academic Calendar · month-by-month class days, events and working-day totals.`
              : 'The academic calendar will appear here once an ERP Academic Calendar is published for this academic year.'}
          </p>
        </div>
      </header>

      <section className="section shell">
        {!planner || !months.length || !active ? (
          <p className="text-muted">
            No published academic calendar yet. In the ERP, open{' '}
            <strong>Academics → Academic Calendar</strong>, add events for the academic year, then
            click <strong>Publish</strong> on the calendar.
          </p>
        ) : (
          <WorkingCalendar months={months} active={active} />
        )}
      </section>
    </main>
  );
}
