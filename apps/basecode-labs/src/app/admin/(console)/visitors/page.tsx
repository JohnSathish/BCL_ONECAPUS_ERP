import { visitorSummary } from '@/lib/visitors';
import { prisma } from '@/lib/prisma';

export default async function VisitorsPage() {
  const summary = await visitorSummary();
  const recent = await prisma.pageView.findMany({ orderBy: { createdAt: 'desc' }, take: 40 });
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Visitor analytics</h1>
      <p className="mt-1 text-sm text-slate-600">
        Unique visitors and page views recorded by the public site beacon.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Today unique', summary.todayUnique],
          ['Today views', summary.todayViews],
          ['All unique', summary.allUnique],
          ['All views', summary.allViews],
        ].map(([label, value]) => (
          <div key={String(label)} className="bcl-card p-5">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <h2 className="mt-8 font-semibold">Last 14 days</h2>
      <ul className="bcl-card mt-3 p-4 text-sm">
        {summary.series.map((d) => (
          <li
            key={d.day}
            className="flex justify-between border-b border-slate-100 py-2 last:border-0"
          >
            <span>{d.day}</span>
            <span>
              {d.uniqueVisitors} unique / {d.pageViews} views
            </span>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 font-semibold">Recent page views</h2>
      <ul className="bcl-card mt-3 p-4 text-sm">
        {recent.length ? (
          recent.map((v) => (
            <li
              key={v.id}
              className="flex justify-between gap-4 border-b border-slate-100 py-2 last:border-0"
            >
              <span className="truncate">{v.path}</span>
              <span className="shrink-0 text-slate-500">{v.createdAt.toLocaleString('en-IN')}</span>
            </li>
          ))
        ) : (
          <li className="py-6 text-center text-slate-500">No page views recorded yet.</li>
        )}
      </ul>
    </div>
  );
}
