import Link from 'next/link';

type Props = {
  variant: 'legacy-planner' | 'legacy-events' | 'primary';
};

export function AcademicCalendarSourceNotice({ variant }: Props) {
  if (variant === 'primary') {
    return (
      <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <p className="font-semibold">Primary calendar for ERP and the public website</p>
        <p className="mt-1 text-muted-foreground">
          Publish this calendar to drive the public Academic Calendar page, homepage Upcoming Events
          (when events are marked Publish to website), Attendance, and Timetable.
        </p>
        <p className="mt-2 text-muted-foreground">
          Website CMS handbook tools are legacy fallbacks only — do not duplicate events there.
        </p>
      </div>
    );
  }

  if (variant === 'legacy-planner') {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-100">
        <p className="font-semibold">Legacy fallback — use Academic Calendar instead</p>
        <p className="mt-1 opacity-90">
          Add events, holidays, and working days once in{' '}
          <strong>Academics → Academic Calendar</strong>, then Publish the calendar. The public
          handbook page and homepage events read from there automatically.
        </p>
        <p className="mt-1 opacity-90">
          This CMS Year Planner is kept only when no ERP calendar is published yet.
        </p>
        <Link
          href="/admin/academics/academic-calendar"
          className="mt-2 inline-block font-medium underline underline-offset-2"
        >
          Open Academic Calendar →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-100">
      <p className="font-semibold">Legacy manual list — ERP calendar is preferred</p>
      <p className="mt-1 opacity-90">
        Homepage Upcoming Events normally loads from <strong>Academics → Academic Calendar</strong>{' '}
        (PUBLIC events with Publish to website). Use this screen only as a fallback when ERP events
        are not available.
      </p>
      <Link
        href="/admin/academics/academic-calendar"
        className="mt-2 inline-block font-medium underline underline-offset-2"
      >
        Open Academic Calendar →
      </Link>
    </div>
  );
}
