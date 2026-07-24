import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicAcademicPlanner } from '@/lib/academic-planner';
import './academic-calendar.css';

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
  const active = months.find((month) => month.key === requested) ?? months[0] ?? null;

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
              ? `${planner.startDate} to ${planner.endDate} · month-by-month class days, events and working-day totals.`
              : 'The handbook calendar will appear here once it is published from the Website CMS Year Planner.'}
          </p>
        </div>
      </header>

      <section className="section shell">
        {!planner || !months.length ? (
          <p className="text-muted">
            No published year planner yet. In the ERP Website CMS, open{' '}
            <strong>Year Planner</strong>, create an academic year, generate months, enter events,
            then Publish.
          </p>
        ) : (
          <>
            <nav className="ac-month-nav" aria-label="Calendar months">
              {months.map((month) => (
                <Link
                  key={month.key}
                  href={`/academics/calendar?month=${month.key}`}
                  className={month.key === active?.key ? 'is-active' : undefined}
                >
                  {month.title}
                </Link>
              ))}
            </nav>

            {active ? (
              <article className="ac-month-card">
                <header className="ac-month-head">
                  <h2>{active.title}</h2>
                  <p>Working Days: {active.workingDays}</p>
                </header>
                <div className="ac-table-wrap">
                  <table className="ac-table">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Day</th>
                        <th scope="col">Status</th>
                        <th scope="col">Events / notes</th>
                        <th scope="col">WD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {active.days.map((day) => (
                        <tr
                          key={day.id}
                          className={
                            day.isHighlighted || day.dayOfWeek === 'SUN'
                              ? 'is-highlight'
                              : undefined
                          }
                        >
                          <td>{day.dayOfMonth}</td>
                          <td>{day.dayOfWeek}</td>
                          <td>{day.statusLabel || (day.dayOfWeek === 'SUN' ? '' : '—')}</td>
                          <td className="ac-events">
                            {day.description
                              ? day.description.split('\n').map((line, index) => (
                                  <span key={`${day.id}-${index}`}>
                                    {line}
                                    {index < day.description.split('\n').length - 1 ? <br /> : null}
                                  </span>
                                ))
                              : null}
                          </td>
                          <td>{day.isWorkingDay ? '✓' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
