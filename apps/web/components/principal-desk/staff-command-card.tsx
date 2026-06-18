'use client';

import Image from 'next/image';
import { Building2, CalendarDays, Clock, Users } from 'lucide-react';
import { SaaSCard, SectionTitle } from '@/components/dashboard/command-center-ui';
import type { StaffCommandCard } from '@/types/principal-desk';

export function StaffCommandCardView({ data }: { data: StaffCommandCard }) {
  return (
    <div className="space-y-4">
      <SaaSCard className="border-violet-200/60 bg-gradient-to-br from-white to-violet-50/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative mx-auto h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-white shadow-lg md:mx-0">
            {data.profile.photoUrl ? (
              <Image
                src={data.profile.photoUrl}
                alt={data.profile.fullName}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-100 text-2xl font-bold text-slate-400">
                {data.profile.fullName.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-black text-slate-900">{data.profile.fullName}</h2>
            <p className="text-sm text-violet-700">
              {data.profile.designation} · {data.profile.department}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Code: <strong>{data.profile.employeeCode}</strong>
              {data.profile.joiningDate && (
                <> · Joined {new Date(data.profile.joiningDate).toLocaleDateString('en-IN')}</>
              )}
            </p>
          </div>
        </div>
      </SaaSCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SaaSCard>
          <SectionTitle title="Attendance Summary" subtitle={data.attendanceSummary.monthLabel} />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Present</p>
              <p className="text-xl font-bold text-emerald-600">
                {data.attendanceSummary.presentDays}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Absent</p>
              <p className="text-xl font-bold text-rose-600">{data.attendanceSummary.absentDays}</p>
            </div>
            <div>
              <p className="text-slate-500">Late Arrivals</p>
              <p className="text-xl font-bold">{data.attendanceSummary.lateArrivals}</p>
            </div>
            <div>
              <p className="text-slate-500">Working Hours</p>
              <p className="text-xl font-bold">{data.attendanceSummary.workingHours}h</p>
            </div>
          </div>
        </SaaSCard>

        <SaaSCard>
          <SectionTitle title="Today's Schedule" />
          {data.todaySchedule.length === 0 ? (
            <p className="text-sm text-slate-500">No classes scheduled today</p>
          ) : (
            <ul className="space-y-2">
              {data.todaySchedule.map((slot) => (
                <li
                  key={slot.period}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
                >
                  <p className="font-semibold text-slate-900">
                    Period {slot.period}: {slot.subject}
                  </p>
                  <p className="flex items-center gap-2 text-xs text-slate-600">
                    <Clock className="h-3 w-3" />
                    {slot.startTime} – {slot.endTime}
                    {slot.room && <> · Room {slot.room}</>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SaaSCard>

        <SaaSCard>
          <SectionTitle title="Leave Information" />
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-amber-50 px-2 py-2">
              <p className="font-bold text-amber-800">{data.leave.pending.length}</p>
              <p className="text-xs text-amber-700">Pending</p>
            </div>
            <div className="rounded-lg bg-emerald-50 px-2 py-2">
              <p className="font-bold text-emerald-800">{data.leave.approved.length}</p>
              <p className="text-xs text-emerald-700">Approved</p>
            </div>
            <div className="rounded-lg bg-rose-50 px-2 py-2">
              <p className="font-bold text-rose-800">{data.leave.rejected.length}</p>
              <p className="text-xs text-rose-700">Rejected</p>
            </div>
          </div>
        </SaaSCard>

        <SaaSCard>
          <SectionTitle title="Committee Memberships" />
          {data.committees.length === 0 ? (
            <p className="text-sm text-slate-500">No committee memberships</p>
          ) : (
            <ul className="space-y-2">
              {data.committees.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-indigo-500" />
                  <span>
                    <strong>{c.committeeName ?? 'Committee'}</strong>
                    {c.role && <> · {c.role}</>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SaaSCard>
      </div>
    </div>
  );
}
