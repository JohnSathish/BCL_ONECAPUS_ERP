'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileBarChart,
  Globe,
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
import { SchoolLicenseStatusCard } from '@/components/school-sis/license/license-desk';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { SlsKpiCard, type SlsKpiTone } from '@/components/school-sis/school-sis-saas';

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
  if (!iso) return '-';
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

function noticeDot(category: string) {
  const c = category.toUpperCase();
  if (c.includes('ACADEMIC')) return 'bg-emerald-500';
  if (c.includes('FINANCE') || c.includes('FEE')) return 'bg-amber-500';
  if (c.includes('EVENT')) return 'bg-violet-500';
  if (c.includes('EXAM')) return 'bg-rose-500';
  return 'bg-sky-500';
}

function ClassBars({ rows }: { rows: { name: string; count: number }[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="flex h-56 min-h-[224px] items-end gap-1 overflow-x-auto px-1 pb-6 pt-4">
      {rows.map((row) => (
        <div
          key={row.name}
          className="flex h-full min-w-[1.75rem] flex-1 flex-col items-center justify-end gap-1"
        >
          <span className="text-[10px] tabular-nums text-slate-500">{row.count}</span>
          <div
            className="w-full max-w-[2.5rem] rounded-t-md bg-sky-500"
            style={{ height: `${Math.max(8, (row.count / max) * 160)}px` }}
            title={`${row.name}: ${row.count}`}
          />
          <span className="max-w-full truncate text-[10px] text-slate-500">{row.name}</span>
        </div>
      ))}
    </div>
  );
}

function GenderDonut({
  rows,
  total,
}: {
  rows: { name: string; value: number; color: string }[];
  total: number;
}) {
  const radius = 64;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg viewBox="0 0 180 180" className="mx-auto h-56 w-56" aria-hidden>
      <circle cx="90" cy="90" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="18" />
      {rows.map((row) => {
        const len = total ? (row.value / total) * circ : 0;
        const el = (
          <circle
            key={row.name}
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke={row.color}
            strokeWidth="18"
            strokeDasharray={`${len} ${Math.max(circ - len, 0)}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 90 90)"
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
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

  const stats: Array<{
    label: string;
    value: number | undefined;
    hint: string;
    href: string;
    icon: typeof GraduationCap;
    tone: SlsKpiTone;
  }> = [
    {
      label: 'Total Students',
      value: counts?.students,
      hint: `${counts?.enrollments ?? 0} enrolled this year`,
      href: '/admin/school-sis/students',
      icon: GraduationCap,
      tone: 'sky',
    },
    {
      label: 'Teachers',
      value: counts?.teachingStaff,
      hint: `${counts?.staff ?? 0} staff in total`,
      href: '/admin/school-sis/teachers',
      icon: Users,
      tone: 'emerald',
    },
    {
      label: 'Non-Teaching Staff',
      value: counts?.nonTeachingStaff,
      hint: 'Office and support staff',
      href: '/admin/school-sis/staff',
      icon: Users,
      tone: 'violet',
    },
    {
      label: 'Classes',
      value: counts?.grades,
      hint: `${counts?.sections ?? 0} sections this year`,
      href: '/admin/school-sis/academic/classes',
      icon: BookOpen,
      tone: 'amber',
    },
    {
      label: 'Upcoming Events',
      value: counts?.eventsUpcoming,
      hint: 'Published on the school website',
      href: '/admin/school-sis/website',
      icon: CalendarDays,
      tone: 'rose',
    },
    {
      label: 'New Enquiries',
      value: counts?.newEnquiries,
      hint: `${counts?.openApplications ?? 0} open applications`,
      href: '/admin/school-sis/admissions',
      icon: Megaphone,
      tone: 'cyan',
    },
  ];

  const shortcuts = [
    canManage
      ? {
          href: '/admin/school-sis/students/new',
          label: 'Add Student',
          icon: UserPlus,
          color: 'bg-sky-50 text-sky-700',
        }
      : null,
    {
      href: '/admin/school-sis/attendance',
      label: 'Take Attendance',
      icon: CheckSquare,
      color: 'bg-emerald-50 text-emerald-700',
    },
    {
      href: '/admin/school-sis/academic/classes',
      label: 'Manage Classes',
      icon: BookOpen,
      color: 'bg-violet-50 text-violet-700',
    },
    {
      href: '/admin/school-sis/website',
      label: 'Publish Notice',
      icon: Megaphone,
      color: 'bg-orange-50 text-orange-700',
    },
    {
      href: '/admin/school-sis/reports/design',
      label: 'View Reports',
      icon: FileBarChart,
      color: 'bg-pink-50 text-pink-700',
    },
    {
      href: '/admin/school-sis/website',
      label: 'Website CMS',
      icon: Globe,
      color: 'bg-cyan-50 text-cyan-700',
    },
    {
      href: '/admin/school-sis/fees',
      label: 'Fee Collection',
      icon: Wallet,
      color: 'bg-amber-50 text-amber-800',
    },
    {
      href: '/admin/school-sis/exams',
      label: 'Examinations',
      icon: ClipboardList,
      color: 'bg-rose-50 text-rose-700',
    },
    {
      href: '/admin/school-sis/library',
      label: 'Library',
      icon: Library,
      color: 'bg-indigo-50 text-indigo-700',
    },
  ].filter(Boolean) as Array<{
    href: string;
    label: string;
    icon: typeof UserPlus;
    color: string;
  }>;

  return (
    <div className="sls-dashboard space-y-5">
      <div className="sls-page-head">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1a365d] sm:text-3xl">
            Welcome back, {welcomeName}!
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s what&apos;s happening at {schoolName}.
          </p>
        </div>
        <div className="sls-page-actions">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
            <CalendarDays className="h-4 w-4 text-sky-600" />
            <div>
              <p className="text-[11px] leading-none text-slate-400">{dateLabel}</p>
              <p className="mt-0.5 font-semibold text-[#1a365d]">{timeLabel}</p>
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
            <span className="text-[11px] uppercase tracking-wide text-slate-400">
              Academic Year
            </span>
            <select
              className="bg-transparent font-medium text-[#1a365d] outline-none"
              value={data?.academicYear.id ?? ''}
              disabled
            >
              <option value={data?.academicYear.id ?? ''}>{data?.academicYear.name ?? '-'}</option>
            </select>
          </label>
          {canManage ? (
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 [&::-webkit-details-marker]:hidden">
                <Zap className="h-4 w-4" />
                Quick Actions
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {shortcuts.slice(0, 6).map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-sky-50"
                  >
                    <action.icon className="h-4 w-4 text-sky-600" />
                    {action.label}
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>

      {overview.isError ? (
        <p className="text-sm text-red-600">{apiErrorMessage(overview.error)}</p>
      ) : null}

      <SchoolLicenseStatusCard variant="banner" />

      <div className="sls-stat-grid">
        {stats.map((card) => (
          <SlsKpiCard
            key={card.label}
            tone={card.tone}
            icon={card.icon}
            label={card.label}
            value={card.value ?? 0}
            hint={card.hint}
            href={card.href}
            loading={overview.isLoading}
          />
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1a365d]">Today&apos;s Timetable</h2>
            <p className="text-xs text-slate-400">Bell periods for this school day</p>
          </div>
          <Link href="/admin/school-sis/timetable" className="text-xs font-semibold text-sky-700">
            Open module {'->'}
          </Link>
        </div>
        {todayTt.isLoading ? (
          <p className="text-sm text-slate-500">Loading timetable...</p>
        ) : todayTt.data?.weekend ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 py-10 text-center">
            <CalendarDays className="h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-600">
              Weekend - no teaching periods.
            </p>
            <p className="text-xs text-slate-400">Enjoy your weekend.</p>
          </div>
        ) : (todayTt.data?.bells ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No bell schedule for today.</p>
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
                  {row.bell.startTime}-{row.bell.endTime}
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
            <p className="text-sm text-slate-500">Loading enrolment...</p>
          ) : classChart.length === 0 && genderChart.length === 0 ? (
            <p className="text-sm text-slate-500">
              No enrolment figures for this year yet. Add students and enrol them in a class and
              section.
            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="min-h-[224px] min-w-0 lg:col-span-3">
                {classChart.length ? (
                  <ClassBars rows={classChart} />
                ) : (
                  <p className="text-sm text-slate-500">No class-wise enrolment yet.</p>
                )}
              </div>
              <div className="relative min-h-[224px] min-w-0 lg:col-span-2">
                {genderChart.length ? (
                  <>
                    <div className="relative mx-auto w-56">
                      <GenderDonut rows={genderChart} total={genderTotal} />
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold text-[#1a365d]">
                          {genderTotal || counts?.students || 0}
                        </p>
                        <p className="text-[11px] text-slate-400">Students</p>
                      </div>
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
                  <div className="flex h-full flex-col justify-center rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    <p>Gender is not recorded for enough students to chart.</p>
                    {(data?.gender.unspecified ?? 0) > 0 ? (
                      <p className="mt-2 text-xs">
                        {data?.gender.unspecified} student
                        {(data?.gender.unspecified ?? 0) === 1 ? '' : 's'} have no gender on file.
                      </p>
                    ) : null}
                    <Link
                      href="/admin/school-sis/students"
                      className="mt-3 text-xs font-semibold text-sky-700"
                    >
                      Update student profiles {'->'}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1a365d]">Latest Notices</h2>
            <Link href="/admin/school-sis/website" className="text-xs font-medium text-sky-700">
              View all
            </Link>
          </div>
          {overview.isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !data?.notices.length ? (
            <p className="text-sm text-slate-500">No published notices yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.notices.map((notice) => (
                <li
                  key={notice.id}
                  className="border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex gap-2">
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        noticeDot(notice.category),
                      )}
                    />
                    <div className="min-w-0">
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
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1a365d]">Upcoming Events</h2>
            <Link href="/admin/school-sis/website" className="text-xs font-medium text-sky-700">
              Calendar
            </Link>
          </div>
          {overview.isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
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
            <p className="text-sm text-slate-500">Loading...</p>
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
          {shortcuts.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-[#1a365d] hover:border-sky-200 hover:shadow-sm"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    action.color,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
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
              {data?.academicYear.name ?? '-'}
              {data?.academicYear.status === 'CURRENT' ? (
                <span className="ml-2 text-xs font-normal text-emerald-600">Active</span>
              ) : null}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Enrolment</p>
            <p className="font-medium text-[#1a365d]">
              {counts?.enrollments ?? '-'} of {counts?.students ?? '-'} students
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Open applications</p>
            <p className="font-medium text-[#1a365d]">{counts?.openApplications ?? '-'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Users</p>
            <p className="font-medium text-[#1a365d]">{counts?.users ?? '-'} active accounts</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                overview.isError ? 'bg-rose-500' : 'bg-emerald-500',
              )}
            />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">System Status</p>
              <p
                className={cn(
                  'font-medium',
                  overview.isError ? 'text-rose-700' : 'text-emerald-700',
                )}
              >
                {overview.isError ? 'Unavailable' : 'Online'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
