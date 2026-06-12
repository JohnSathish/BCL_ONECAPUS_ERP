'use client';

import Link from 'next/link';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Progress } from '@/components/ui/progress';
import type { StudentPortalProfile360 } from '@/types/student-portal-profile';
import { cn } from '@/utils/cn';
import { attendanceBarClass, attendanceTone } from './profile-utils';

export function ProfileAttendanceWidget({ profile }: { profile: StudentPortalProfile360 }) {
  const overall = profile.attendance.overall;
  const tone = attendanceTone(overall);

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Attendance</h2>
        <Link href="/student/attendance" className="text-xs text-primary">
          Details
        </Link>
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums">
        {overall != null ? `${Math.round(overall)}%` : '—'}
      </p>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', attendanceBarClass(tone))}
          style={{ width: `${Math.min(100, overall ?? 0)}%` }}
        />
      </div>
      {profile.attendance.subjects.length ? (
        <ul className="mt-4 space-y-2">
          {profile.attendance.subjects.slice(0, 5).map((s) => {
            const subTone = attendanceTone(s.percentage);
            return (
              <li key={s.id ?? s.label ?? s.courseName} className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    subTone === 'good' && 'bg-emerald-500',
                    subTone === 'warn' && 'bg-amber-500',
                    subTone === 'bad' && 'bg-rose-500',
                    subTone === 'neutral' && 'bg-muted-foreground',
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {s.label ?? s.courseName ?? 'Subject'}
                </span>
                <span className="font-semibold tabular-nums">{Math.round(s.percentage)}%</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </GlassCard>
  );
}

export function ProfileFeeWidget({ profile }: { profile: StudentPortalProfile360 }) {
  const paid = profile.fees.status === 'PAID' || profile.fees.currentDue <= 0;

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Fee Status</h2>
        <Link href="/student/fees" className="text-xs text-primary">
          Pay now
        </Link>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {paid ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Paid</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <span className="text-lg font-bold text-amber-700 dark:text-amber-400">Pending</span>
          </>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Current Semester</p>
      <p className="text-xl font-bold tabular-nums">
        {paid ? '₹0 Due' : `₹${profile.fees.currentDue.toLocaleString()}`}
      </p>
      {!paid ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Paid so far: ₹{profile.fees.paidAmount.toLocaleString()}
        </p>
      ) : null}
    </GlassCard>
  );
}

export function ProfileStatistics({ profile }: { profile: StudentPortalProfile360 }) {
  const stats = profile.statistics ?? {
    libraryBooks: 0,
    certificates: profile.certificates.length,
    assignments: 0,
    attendance: profile.attendance.overall,
    cgpa: null,
  };

  const items = [
    { label: 'Library Books', value: stats.libraryBooks },
    { label: 'Certificates', value: stats.certificates },
    { label: 'Assignments', value: stats.assignments },
    {
      label: 'Attendance',
      value: stats.attendance != null ? `${Math.round(stats.attendance)}%` : '—',
    },
    { label: 'CGPA', value: stats.cgpa != null ? String(stats.cgpa) : '—' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <GlassCard key={item.label} className="p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums">{item.value}</p>
        </GlassCard>
      ))}
    </div>
  );
}

export function ProfileActivityTimeline({ profile }: { profile: StudentPortalProfile360 }) {
  const activity = profile.recentActivity ?? [];
  if (!activity.length) return null;

  return (
    <GlassCard className="p-5">
      <h2 className="text-sm font-semibold tracking-tight">Recent Activity</h2>
      <ul className="mt-4 space-y-3">
        {activity.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-3.5 w-3.5 text-primary" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(item.occurredAt).toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
