'use client';

import { AlertTriangle, Megaphone } from 'lucide-react';

import type { LibraryAccessDeskDashboard } from '@/types/library';

function Tile({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`rounded-2xl px-3 py-3 ${tone}`}>
      <p className="text-lg font-bold tabular-nums text-slate-900">{value}</p>
      <p className="text-[11px] font-medium text-slate-600">{label}</p>
    </div>
  );
}

function memberLabel(memberType: string) {
  if (memberType === 'STUDENT') return 'Student';
  if (memberType === 'FACULTY') return 'Faculty';
  if (memberType === 'STAFF') return 'Staff';
  if (memberType === 'VISITOR') return 'Visitor';
  return memberType;
}

export function LibraryDeskSidePanel({ data }: { data?: LibraryAccessDeskDashboard }) {
  const occ = data?.occupancy;
  const stats = data?.stats;
  const seats = occ?.totalSeats ?? 0;
  const inside = occ?.totalInside ?? 0;
  const occupancyPercent = seats > 0 ? Math.min(100, Math.round((inside / seats) * 100)) : null;
  const notices = data?.alerts ?? [];
  const autoSignedOut = stats?.autoSignedOutToday ?? 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Megaphone className="h-4 w-4 text-rose-500" />
          Library notice board
        </div>
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="rounded-xl bg-sky-50 px-3 py-2">
            A visit still open after one hour is signed out automatically, so missed check-outs do
            not stay on the inside count.
          </li>
          {autoSignedOut > 0 ? (
            <li className="rounded-xl bg-amber-50 px-3 py-2">
              {autoSignedOut} visit{autoSignedOut === 1 ? '' : 's'} signed out automatically today.
            </li>
          ) : null}
          {notices.map((notice) => (
            <li key={notice.id} className="rounded-xl bg-rose-50 px-3 py-2">
              {notice.message}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Live occupancy</h3>
          <span className="text-xs font-semibold text-slate-500">
            {inside}
            {seats > 0 ? ` / ${seats}` : ''}
          </span>
        </div>
        {occupancyPercent != null ? (
          <div className="mb-3">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sky-500"
                style={{ width: `${occupancyPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">{occupancyPercent}% of configured seats</p>
          </div>
        ) : (
          <p className="mb-3 text-xs text-slate-500">
            Seat capacity is not set in Library Settings.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Students inside" value={occ?.studentsInside ?? '—'} tone="bg-sky-50" />
          <Tile
            label="Staff inside"
            value={occ ? occ.facultyInside + occ.staffInside : '—'}
            tone="bg-violet-50"
          />
          <Tile label="Visitors inside" value={occ?.visitorsInside ?? '—'} tone="bg-amber-50" />
          <Tile label="Seats free" value={occ?.availableSeats ?? '—'} tone="bg-emerald-50" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Tile label="Male students" value={occ?.maleStudents ?? '—'} tone="bg-rose-50" />
          <Tile label="Female students" value={occ?.femaleStudents ?? '—'} tone="bg-emerald-50" />
          <Tile label="Male staff" value={occ?.maleStaffInside ?? '—'} tone="bg-orange-50" />
          <Tile label="Female staff" value={occ?.femaleStaffInside ?? '—'} tone="bg-pink-50" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Today&apos;s activity</h3>
        {(data?.recentActivity.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-500">No entry or exit recorded today.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-1 pr-2 font-medium">Time</th>
                  <th className="py-1 pr-2 font-medium">Member</th>
                  <th className="py-1 pr-2 font-medium">Type</th>
                  <th className="py-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentActivity.slice(0, 8).map((row, index) => (
                  <tr key={`${row.at}-${index}`} className="border-t border-slate-100">
                    <td className="py-2 pr-2 text-slate-500">
                      {new Date(row.at).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="max-w-[8rem] truncate py-2 pr-2 font-medium text-slate-800">
                      {row.memberName}
                    </td>
                    <td className="py-2 pr-2 text-slate-500">{memberLabel(row.memberType)}</td>
                    <td className="py-2">
                      <span
                        className={
                          row.action === 'IN'
                            ? 'rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700'
                            : 'rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600'
                        }
                      >
                        {row.action === 'IN' ? 'Entry' : 'Exit'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {notices.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Alerts
          </p>
          <ul className="space-y-1">
            {notices.map((notice) => (
              <li key={`alert-${notice.id}`}>{notice.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
