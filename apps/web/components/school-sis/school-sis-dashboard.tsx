'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Library,
  Megaphone,
  Users,
  UserPlus,
  Wallet,
  Zap,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useBranding } from '@/hooks/use-branding';
import { useAuthStore } from '@/store/auth-store';
import { fetchSchoolSisOverview, fetchSchoolSisTimetableToday } from '@/services/school-sis';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const SKY = '#0ea5e9';
const GENDER_COLORS = { male: '#2563eb', female: '#ec4899', other: '#94a3b8' };

function applicationStatusLabel(status: string) {
  const map: Record<string, string> = {
    SUBMITTED: 'New',
    UNDER_REVIEW: 'Under Review',
    WAITLIST: 'Shortlisted',
    OFFERED: 'Offered',
    REJECTED: 'Rejected',
    ENROLLED: 'Enrolled',
  };
  return map[status] ?? status.replace(/_/g, ' ');
}

function statusTone(status: string) {
  const map: Record<string, string> = {
    SUBMITTED: 'bg-sky-50 text-sky-700',
    UNDER_REVIEW: 'bg-amber-50 text-amber-800',
    WAITLIST: 'bg-violet-50 text-violet-700',
    OFFERED: 'bg-emerald-50 text-emerald-700',
    REJECTED: 'bg-rose-50 text-rose-700',
    ENROLLED: 'bg-slate-100 text-slate-700',
  };
  return map[status] ?? 'bg-slate-100 text-slate-600';
}

function formatDay(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function SchoolSisDashboard() {
  const enabled = useAuthQueryEnabled();
  const { branding, displayName } = useBranding();
  const user = useAuthStore((s) => s.session?.user);
  const welcomeName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'there';
  const schoolName = branding?.displayName || displayName || "St. Luke's Secondary School";
  const canManage = canManageSchoolSis(user?.permissions);
  const overview = useQuery({
    queryKey: ['school-sis-overview'],
    queryFn: fetchSchoolSisOverview,
    enabled,
  });
  const todayTt = useQuery({
    queryKey: ['school-sis-timetable-today'],
    queryFn: fetchSchoolSisTimetableToday,
    enabled,
  });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const data = overview.data;
  const counts = data?.counts;
  const genderChart = useMemo(() => {
    if (!data) return [];
    const rows = [
      { name: 'Boys', value: data.gender.male, color: GENDER_COLORS.male },
      { name: 'Girls', value: data.gender.female, color: GENDER_COLORS.female },
    ];
    if (data.gender.other)
      rows.push({ name: 'Other', value: data.gender.other, color: GENDER_COLORS.other });
    return rows.filter((r) => r.value > 0);
  }, [data]);

  const classChart =
    data?.byClass?.map((row) => ({
      name: row.name.replace(/^Class\s+/i, ''),
      count: row.count,
    })) ?? [];

  const genderTotal =
    (data?.gender.male ?? 0) + (data?.gender.female ?? 0) + (data?.gender.other ?? 0);
  const dateLabel = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const stats = [
    {
      label: 'Total Students',
      value: counts?.students,
      hint: 'Active student records',
      href: '/admin/school-sis/students',
      icon: GraduationCap,
      tone: 'bg-sky-50 text-sky-700',
    },
    {
      label: 'Teachers',
      value: counts?.teachingStaff,
      hint: 'Teaching staff',
      href: '/admin/school-sis/staff',
      icon: Users,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Non-Teaching Staff',
      value: counts?.nonTeachingStaff,
      hint: 'Office and support staff',
      href: '/admin/school-sis/staff',
      icon: Users,
      tone: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Classes',
      value: counts?.grades,
      hint: `${counts?.sections ?? 0} sections this year`,
      href: '/admin/school-sis/classes',
      icon: BookOpen,
      tone: 'bg-orange-50 text-orange-700',
    },
    {
      label: 'Upcoming Events',
      value: counts?.eventsUpcoming,
      hint: 'Published on the school website',
      icon: CalendarDays,
      tone: 'bg-pink-50 text-pink-700',
    },
    {
      label: 'New Enquiries',
      value: counts?.newEnquiries,
      hint: 'Website contact form',
      icon: Megaphone,
      tone: 'bg-cyan-50 text-cyan-700',
    },
  ];

  const quickActions = [
    canManage
      ? { href: '/admin/school-sis/students/new', label: 'Add Student', icon: UserPlus, live: true }
      : null,
    { href: '/admin/school-sis/students', label: 'Student List', icon: GraduationCap, live: true },
    { href: '/admin/school-sis/staff', label: 'Teacher List', icon: Users, live: true },
    {
      href: '/admin/school-sis/admissions',
      label: 'Applications',
      icon: ClipboardList,
      live: true,
    },
    { href: '#', label: 'Add Notice', icon: Megaphone, live: false },
    { href: '#', label: 'Add Event', icon: CalendarDays, live: false },
    { href: '#', label: 'Fee Collection', icon: Wallet, live: false },
    { href: '#', label: 'Attendance', icon: ClipboardList, live: false },
    { href: '#', label: 'Examination', icon: BookOpen, live: false },
    { href: '#', label: 'Library', icon: Library, live: false },
  ].filter(Boolean) as Array<{ href: string; label: string; icon: typeof UserPlus; live: boolean }>;

  return (
    <div className="sls-dashboard space-y-5">
      <div className="sls-page-head">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1a365d]">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back, {welcomeName}! Here&apos;s what&apos;s happening at {schoolName}.
          </p>
        </div>
        <div className="sls-page-actions">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
            <span className="text-[11px] uppercase tracking-wide text-slate-400">Year</span>
            <select
              className="bg-transparent font-medium text-[#1a365d] outline-none"
              value={data?.academicYear.id ?? ''}
              disabled
            >
              <option value={data?.academicYear.id ?? ''}>{data?.academicYear.name ?? '—'}</option>
            </select>
          </label>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
            {dateLabel}
            <span className="ml-2 font-medium text-[#1a365d]">{timeLabel}</span>
          </div>
          {canManage ? (
            <Link
              href="/admin/school-sis/students/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[#1a365d] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#163056]"
            >
              <Zap className="h-4 w-4" />
              Quick Actions
            </Link>
          ) : null}
        </div>
      </div>

      {overview.isError ? (
        <p className="text-sm text-red-600">{apiErrorMessage(overview.error)}</p>
      ) : null}

      <div className="sls-stat-grid">
        {stats.map((card) => {
          const Icon = card.icon;
          const inner = (
            <>
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn('flex h-9 w-9 items-center justify-center rounded-xl', card.tone)}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {card.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#1a365d]">
                {overview.isLoading ? '—' : (card.value ?? 0)}
              </p>
              <p className="mt-1 text-xs text-slate-400">{card.hint}</p>
            </>
          );
          const className =
            'min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]';
          if (card.href) {
            return (
              <Link
                key={card.label}
                href={card.href}
                className={cn(className, 'hover:border-sky-200')}
              >
                {inner}
              </Link>
            );
          }
          return (
            <div key={card.label} className={className}>
              {inner}
            </div>
          );
        })}
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1a365d]">Today's Timetable</h2>
          <Link href="/admin/school-sis/timetable" className="text-xs font-semibold text-sky-700">
            Open module
          </Link>
        </div>
        {todayTt.data?.weekend ? (
          <p className="text-sm text-slate-500">Weekend — no teaching periods.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(todayTt.data?.bells ?? []).map((row: any) => (
              <div
                key={row.bell.id}
                className={cn(
                  'min-w-[140px] rounded-xl border px-3 py-2 text-xs',
                  row.bell.kind === 'BREAK' && 'border-sky-200 bg-sky-50',
                  row.state === 'current' && 'border-[#1a365d] bg-[#1a365d] text-white',
                  row.state === 'completed' && 'opacity-50',
                )}
              >
                <p className="font-semibold uppercase tracking-wide">{row.bell.label}</p>
                <p>
                  {row.bell.startTime}–{row.bell.endTime}
                </p>
                {row.state === 'current' ? <p>Now</p> : null}
                {row.state === 'upcoming' && todayTt.data?.next?.bell?.id === row.bell.id ? (
                  <p>Next</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1a365d]">Student Overview</h2>
            <span className="text-xs text-slate-400">{data?.academicYear.name}</span>
          </div>
          {overview.isLoading ? (
            <p className="text-sm text-slate-500">Loading enrolment…</p>
          ) : classChart.length === 0 && genderChart.length === 0 ? (
            <p className="text-sm text-slate-500">
              No enrolment figures for this year yet. Add students and enrol them in a class and
              section.
            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="h-56 lg:col-span-3">
                {classChart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill={SKY} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-slate-500">No class-wise enrolment yet.</p>
                )}
              </div>
              <div className="relative h-56 lg:col-span-2">
                {genderChart.length ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={genderChart}
                          dataKey="value"
                          innerRadius={52}
                          outerRadius={78}
                          paddingAngle={2}
                        >
                          {genderChart.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-lg font-semibold text-[#1a365d]">
                        {genderTotal || counts?.students || 0}
                      </p>
                      <p className="text-[11px] text-slate-400">Students</p>
                    </div>
                    <div className="mt-1 flex justify-center gap-3 text-[11px] text-slate-500">
                      {genderChart.map((g) => (
                        <span key={g.name}>
                          {g.name} {genderTotal ? Math.round((g.value / genderTotal) * 100) : 0}%
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Gender is not recorded for enough students to chart.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1a365d]">Latest Notices</h2>
            <span className="text-xs text-slate-400">Website CMS</span>
          </div>
          {overview.isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !data?.notices.length ? (
            <p className="text-sm text-slate-500">No published notices yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.notices.map((notice) => (
                <li
                  key={notice.id}
                  className="border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                >
                  <p className="text-sm font-medium text-slate-800">{notice.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700">
                      {notice.category}
                    </span>
                    {notice.featured ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                        Important
                      </span>
                    ) : null}
                    <span>{formatDay(notice.publishedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="mb-3 text-sm font-semibold text-[#1a365d]">Upcoming Events</h2>
          {overview.isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !data?.events.length ? (
            <p className="text-sm text-slate-500">No upcoming published events.</p>
          ) : (
            <ul className="space-y-3">
              {data.events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <div className="w-14 shrink-0 rounded-xl bg-sky-50 px-2 py-1.5 text-center">
                    <p className="text-[10px] font-semibold uppercase text-sky-700">
                      {new Date(event.startsAt).toLocaleDateString('en-IN', { month: 'short' })}
                    </p>
                    <p className="text-lg font-semibold text-[#1a365d]">
                      {new Date(event.startsAt).getDate()}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{event.title}</p>
                    <p className="text-xs text-slate-500">
                      {formatTime(event.startsAt)}
                      {event.venue ? ` · ${event.venue}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1a365d]">Recent Applications</h2>
            <Link
              href="/admin/school-sis/admissions"
              className="text-xs font-medium text-sky-700 hover:underline"
            >
              View all
            </Link>
          </div>
          {overview.isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !data?.recentApplications.length ? (
            <p className="text-sm text-slate-500">No admission applications yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="pb-2 font-medium">Applicant</th>
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium">Number</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentApplications.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 font-medium text-slate-800">{row.applicant}</td>
                      <td className="py-2 text-slate-600">{row.classLabel}</td>
                      <td className="py-2 text-slate-600">{row.applicationNumber}</td>
                      <td className="py-2 text-slate-500">{formatDay(row.submittedAt)}</td>
                      <td className="py-2">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-medium',
                            statusTone(row.status),
                          )}
                        >
                          {applicationStatusLabel(row.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <h2 className="mb-3 text-sm font-semibold text-[#1a365d]">Quick Links</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {quickActions.map((action) => {
            const Icon = action.icon;
            if (!action.live) {
              return (
                <div
                  key={action.label}
                  className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400"
                >
                  <Icon className="h-4 w-4" />
                  <span>{action.label}</span>
                </div>
              );
            }
            return (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm font-medium text-[#1a365d] hover:border-sky-200 hover:bg-sky-50"
              >
                <Icon className="h-4 w-4 text-sky-600" />
                {action.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">School Year</p>
            <p className="font-medium text-[#1a365d]">
              {data?.academicYear.name ?? '—'}
              {data?.academicYear.status === 'CURRENT' ? (
                <span className="ml-2 text-xs font-normal text-emerald-600">Active</span>
              ) : null}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Total Users</p>
            <p className="font-medium text-[#1a365d]">{counts?.users ?? '—'} active accounts</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Storage Used</p>
            <p className="font-medium text-slate-500">Not configured</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Last Backup</p>
            <p className="font-medium text-slate-500">Not configured</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">System Status</p>
              <p className="font-medium text-emerald-700">
                {overview.isError ? 'Unavailable' : 'Online'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
