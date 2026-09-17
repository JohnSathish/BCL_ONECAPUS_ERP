'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  activateSchoolAcademicYear,
  downloadSchoolSisTimetableExcel,
  downloadSchoolSisTimetablePdf,
  fetchSchoolAcademicYears,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const LINKS = [
  { href: '/admin/school-sis/timetable', label: 'Dashboard', exact: true, icon: 'home' },
  { href: '/admin/school-sis/timetable/weekly', label: 'Weekly', icon: 'week' },
  { href: '/admin/school-sis/timetable/class', label: 'Class-wise', icon: 'class' },
  { href: '/admin/school-sis/timetable/teacher', label: 'Teacher-wise', icon: 'teacher' },
  { href: '/admin/school-sis/timetable/mine', label: 'My Timetable', icon: 'mine' },
  { href: '/admin/school-sis/timetable/settings', label: 'Periods', icon: 'clock' },
  { href: '/admin/school-sis/timetable/conflicts', label: 'Conflicts', icon: 'alert' },
  { href: '/admin/school-sis/timetable/print', label: 'Print / Export', icon: 'print' },
];

function TabIcon({ name, active }: { name: string; active?: boolean }) {
  const stroke = active ? '#ffffff' : '#64748b';
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const paths: Record<string, string> = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    week: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    class:
      'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
    teacher:
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    mine: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    clock: 'M12 8v4l3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    alert:
      'M10.3 4.3 1.8 19a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
    print:
      'M6 9V3h12v6M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 13h12v8H6z',
  };
  return (
    <svg {...common}>
      <path d={paths[name] ?? paths.home} />
    </svg>
  );
}

export function TimetableChrome({
  title,
  hint,
  children,
  actions,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const years = useQuery({
    queryKey: ['school-academic-years'],
    queryFn: fetchSchoolAcademicYears,
    enabled,
  });
  const [exportOpen, setExportOpen] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);
  const yearRows = Array.isArray(years.data) ? years.data : [];
  const current = yearRows.find((y) => y.status === 'CURRENT') ?? yearRows[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1e3a8a] text-white shadow-sm">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Academic · Timetable
            </p>
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
            {hint ? <p className="mt-1 max-w-3xl text-sm text-slate-500">{hint}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <select
              className="bg-transparent text-sm font-medium outline-none"
              value={current?.id ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                if (!id || id === current?.id) return;
                if (
                  typeof window !== 'undefined' &&
                  !window.confirm(
                    `Switch the current academic year to ${e.target.selectedOptions[0]?.text}?`,
                  )
                )
                  return;
                void activateSchoolAcademicYear(id)
                  .then(() => {
                    void qc.invalidateQueries({ queryKey: ['school-academic-years'] });
                    void qc.invalidateQueries({ queryKey: ['school-sis-timetable'] });
                    void qc.invalidateQueries({ queryKey: ['school-sis-timetable-dashboard'] });
                  })
                  .catch((err) => setYearError(apiErrorMessage(err)));
              }}
            >
              {yearRows.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Quick Actions
            </p>
            <div className="flex flex-wrap items-center gap-1">
              <Link
                href="/admin/school-sis/timetable/print"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Print Timetable
              </Link>
              <div className="relative">
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setExportOpen((v) => !v)}
                >
                  Export
                </button>
                {exportOpen ? (
                  <div className="absolute right-0 z-20 mt-1 min-w-[9rem] rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg">
                    <button
                      className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                      onClick={() => {
                        setExportOpen(false);
                        void downloadSchoolSisTimetablePdf();
                      }}
                    >
                      PDF
                    </button>
                    <button
                      className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                      onClick={() => {
                        setExportOpen(false);
                        void downloadSchoolSisTimetableExcel();
                      }}
                    >
                      Excel
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          {actions}
        </div>
      </div>
      {yearError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {yearError}
        </p>
      ) : null}
      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {LINKS.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium',
                active ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <TabIcon name={link.icon} active={active} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

export function printedClock(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(hr).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
}

export function printedRange(start: string, end: string) {
  return `${printedClock(start)} – ${printedClock(end)}`;
}
