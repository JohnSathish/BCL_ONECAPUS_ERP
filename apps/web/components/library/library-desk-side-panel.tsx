'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, BookOpen, LogIn, LogOut, Megaphone, Users } from 'lucide-react';

import type { LibraryAccessDeskDashboard } from '@/types/library';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { cn } from '@/utils/cn';

const NOTICE_SLIDES = [
  { title: 'Library Announcements', body: 'Extended hours during exam season — open until 8 PM.' },
  { title: 'New Books', body: '50+ new titles added in Economics & English sections this week.' },
  {
    title: 'Library Rules',
    body: 'Maintain silence · No food · Mobile on silent · ID card mandatory.',
  },
  { title: 'Upcoming Event', body: 'Reading Challenge 2026 — register at the circulation desk.' },
  {
    title: 'Quote of the Day',
    body: '"A room without books is like a body without a soul." — Cicero',
  },
];

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-lg font-bold tabular-nums text-white">{value}</p>
      {sub ? <p className="text-[10px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

function NoticeBoard() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % NOTICE_SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);
  const slide = NOTICE_SLIDES[idx]!;
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 to-slate-900/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
        <Megaphone className="h-3.5 w-3.5" />
        Digital Notice Board
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.35 }}
        >
          <p className="text-sm font-semibold text-white">{slide.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{slide.body}</p>
        </motion.div>
      </AnimatePresence>
      <div className="mt-3 flex gap-1">
        {NOTICE_SLIDES.map((_, i) => (
          <span
            key={i}
            className={cn('h-1 flex-1 rounded-full', i === idx ? 'bg-cyan-400' : 'bg-white/10')}
          />
        ))}
      </div>
    </div>
  );
}

export function LibraryDeskSidePanel({ data }: { data?: LibraryAccessDeskDashboard }) {
  const occ = data?.occupancy;
  const stats = data?.stats;
  const peak =
    stats?.peakHour != null
      ? `${String(stats.peakHour).padStart(2, '0')}:00–${String(stats.peakHour + 1).padStart(2, '0')}:00`
      : '—';

  return (
    <div className="space-y-4">
      <NoticeBoard />

      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Users className="h-4 w-4 text-cyan-400" />
          Live Occupancy
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Students Inside" value={occ?.studentsInside ?? '—'} />
          <StatTile
            label="Staff Inside"
            value={(occ?.facultyInside ?? 0) + (occ?.staffInside ?? 0)}
          />
          <StatTile label="Visitors Inside" value={occ?.visitorsInside ?? '—'} />
          <StatTile
            label="Seats Free"
            value={occ?.availableSeats ?? '—'}
            sub={`of ${occ?.totalSeats ?? '—'}`}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
          <StatTile label="Male Students" value={occ?.maleStudents ?? '—'} />
          <StatTile label="Female Students" value={occ?.femaleStudents ?? '—'} />
          <StatTile label="Male Staff" value={occ?.maleStaffInside ?? '—'} />
          <StatTile label="Female Staff" value={occ?.femaleStaffInside ?? '—'} />
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Today&apos;s Activity</h3>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Entries" value={stats?.entriesToday ?? '—'} />
          <StatTile label="Exits" value={stats?.exitsToday ?? '—'} />
          <StatTile label="Peak Hour" value={peak} />
          <StatTile label="Avg Stay" value={stats ? `${stats.avgStayMinutes}m` : '—'} />
          <StatTile label="Books Issued" value={stats?.booksIssuedToday ?? '—'} />
          <StatTile label="Books Returned" value={stats?.booksReturnedToday ?? '—'} />
        </div>
      </div>

      {data?.departmentInside?.length ? (
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Departments Inside Now</h3>
          <ul className="max-h-36 space-y-1 overflow-y-auto text-xs">
            {data.departmentInside.map((row) => (
              <li
                key={row.name}
                className="flex justify-between gap-2 rounded px-2 py-1 hover:bg-white/5"
              >
                <span className="truncate text-slate-300">{row.name}</span>
                <span className="font-bold tabular-nums text-cyan-300">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <BookOpen className="h-4 w-4 text-cyan-400" />
          Recent Activity
        </h3>
        <ul className="max-h-52 space-y-2 overflow-y-auto text-xs">
          {(data?.recentActivity ?? []).map((row, i) => (
            <li
              key={`${row.at}-${i}`}
              className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5"
            >
              {row.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveUploadAssetUrl(row.photoUrl) ?? ''}
                  alt=""
                  className="mt-0.5 h-7 w-7 rounded object-cover"
                />
              ) : (
                <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded bg-slate-800 text-[10px]">
                  {row.memberName.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">
                  {new Date(row.at).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  — {row.memberName}
                </p>
                <p className="flex items-center gap-1 text-slate-500">
                  {row.action === 'IN' ? (
                    <LogIn className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <LogOut className="h-3 w-3 text-amber-400" />
                  )}
                  {row.action === 'IN' ? 'Entry' : 'Exit'}
                  {row.department ? ` · ${row.department}` : ''}
                </p>
              </div>
            </li>
          ))}
          {!data?.recentActivity?.length ? (
            <li className="py-4 text-center text-slate-500">No activity yet today</li>
          ) : null}
        </ul>
      </div>

      {(data?.alerts?.length ?? 0) > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            Security & Alerts
          </h3>
          <ul className="space-y-2 text-xs">
            {data!.alerts.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-amber-500/20 px-3 py-2 text-amber-100"
              >
                {a.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
