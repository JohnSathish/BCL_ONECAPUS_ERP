'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Users,
} from 'lucide-react';

import { staffTypeLabel } from '@/components/staff-module/directory/staff-filter-utils';
import { resolveUploadAvatarUrl } from '@/lib/branding-asset';
import { fetchMyStaffDocumentCompliance } from '@/services/staff';
import type { StaffDashboardData, StaffTimetableSlot } from '@/types/staff-portal';
import { cn } from '@/utils/cn';

const TABS = [
  { label: 'Overview', href: '/staff/dashboard' },
  { label: 'Basic Information', href: '/staff/profile?tab=personal' },
  { label: 'Academic Details', href: '/staff/profile?tab=qualifications' },
  { label: 'Subjects', href: '/staff/academic/subjects' },
  { label: 'Timetable', href: '/staff/academic/timetable' },
  { label: 'Attendance', href: '/staff/attendance' },
  { label: 'Leave & Permissions', href: '/staff/leave' },
  { label: 'Documents', href: '/staff/documents' },
  { label: 'Reports', href: '/staff/administration/reports' },
  { label: 'Settings', href: '/staff/settings' },
];

function clock(value: string) {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function classKind(slot: StaffTimetableSlot) {
  const text = `${slot.subject} ${slot.status}`.toLowerCase();
  if (text.includes('practical') || text.includes('lab')) return 'Practical';
  if (text.includes('meeting')) return 'Meeting';
  return 'Theory';
}

function kindClass(kind: string) {
  if (kind === 'Practical') return 'bg-emerald-50 text-emerald-700';
  if (kind === 'Meeting') return 'bg-amber-50 text-amber-700';
  return 'bg-sky-50 text-sky-700';
}

function formatSemesters(semesters: number[]) {
  if (!semesters.length) return '—';
  return semesters.map((semester) => `Sem ${semester}`).join(', ');
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return '';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

function dateBadge(dateKey?: string) {
  if (!dateKey) return { day: '—', month: '' };
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { day: dateKey, month: '' };
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
  };
}

export function StaffHomeOverview({ data }: { data: StaffDashboardData }) {
  const { profile, academicContext } = data;
  const photoSrc = profile.photoUrl ? resolveUploadAvatarUrl(profile.photoUrl) : null;
  const todaySlots = data.todaySchedule.filter((slot) => slot.isToday !== false);
  const upcomingSlots = data.todaySchedule.filter((slot) => slot.isToday === false).slice(0, 4);
  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const students =
    data.performanceSnapshot?.studentsTaught ??
    data.subjects.reduce((sum, subject) => sum + (subject.studentCount || 0), 0);
  const docsQ = useQuery({
    queryKey: ['staff-portal', 'documents-compliance'],
    queryFn: fetchMyStaffDocumentCompliance,
  });
  const documentSlots = docsQ.data?.slots ?? [];
  const documentsDone =
    documentSlots.length > 0 && documentSlots.every((slot) => slot.status !== 'MISSING');
  const checks = [
    {
      label: 'Personal Details',
      done: Boolean(profile.fullName && profile.gender && profile.dateOfBirth),
    },
    { label: 'Contact Information', done: Boolean(profile.email && profile.mobile) },
    {
      label: 'Academic Details',
      done: Boolean(profile.qualification || profile.specialization || profile.experienceYears),
    },
    { label: 'Upload Photo', done: Boolean(profile.photoUrl) },
    { label: 'Upload Documents', done: documentsDone },
  ];
  const completion = Math.max(0, Math.min(100, profile.profileCompletion ?? 0));
  const upcomingEvents = (data.calendarEvents ?? [])
    .filter((event) => event.date >= new Date().toISOString().slice(0, 10))
    .slice(0, 4);
  const actions = [
    {
      label: 'Take Attendance',
      href: '/staff/academic/attendance-entry',
      icon: ClipboardList,
      className: 'bg-sky-50 text-sky-600',
      teaching: true,
    },
    {
      label: 'Enter Marks',
      href: '/staff/academic/marks',
      icon: FileText,
      className: 'bg-violet-50 text-violet-600',
      teaching: true,
    },
    {
      label: 'Upload Lesson Plan',
      href: '/staff/academic/lesson-plans',
      icon: BookOpen,
      className: 'bg-indigo-50 text-indigo-600',
      teaching: true,
    },
    {
      label: 'Create Assignment',
      href: '/staff/academic/homework',
      icon: FileText,
      className: 'bg-amber-50 text-amber-600',
      teaching: true,
    },
    {
      label: 'View Students',
      href: '/staff/academic/students',
      icon: Users,
      className: 'bg-emerald-50 text-emerald-600',
      teaching: true,
    },
    {
      label: 'Open Timetable',
      href: '/staff/academic/timetable',
      icon: CalendarDays,
      className: 'bg-orange-50 text-orange-600',
      teaching: false,
    },
    {
      label: 'Apply Leave',
      href: '/staff/leave',
      icon: CalendarDays,
      className: 'bg-lime-50 text-lime-700',
      teaching: false,
    },
    {
      label: 'View Subjects',
      href: '/staff/academic/subjects',
      icon: GraduationCap,
      className: 'bg-rose-50 text-rose-600',
      teaching: true,
    },
  ].filter((action) => profile.isTeaching || !action.teaching);

  const kpis = profile.isTeaching
    ? [
        {
          label: "Today's Classes",
          value: todaySlots.length,
          hint: 'View Timetable',
          href: '/staff/academic/timetable',
          icon: GraduationCap,
          className: 'bg-sky-50 text-sky-600',
        },
        {
          label: 'Assigned Subjects',
          value: data.kpis.teachingLoad.assignedSubjects,
          hint: 'View Subjects',
          href: '/staff/academic/subjects',
          icon: BookOpen,
          className: 'bg-emerald-50 text-emerald-600',
        },
        {
          label: 'Total Students',
          value: students,
          hint: 'Across all subjects',
          href: '/staff/academic/students',
          icon: Users,
          className: 'bg-violet-50 text-violet-600',
        },
        {
          label: 'Attendance Pending',
          value: data.kpis.tasks.attendancePending,
          hint: 'Classes to mark',
          href: '/staff/academic/attendance-entry',
          icon: ClipboardList,
          className: 'bg-rose-50 text-rose-600',
        },
        {
          label: 'LMS Pending',
          value: data.kpis.tasks.lmsPendingEvaluations,
          hint: 'Assignments to review',
          href: '/staff/academic/lms',
          icon: FileText,
          className: 'bg-amber-50 text-amber-600',
        },
      ]
    : [
        {
          label: 'Attendance',
          value: `${data.kpis.attendance.percentage}%`,
          hint: 'This period',
          href: '/staff/attendance',
          icon: ClipboardList,
          className: 'bg-emerald-50 text-emerald-600',
        },
        {
          label: 'Leave Pending',
          value: data.kpis.leave.pendingRequests,
          hint: 'Requests in review',
          href: '/staff/leave',
          icon: CalendarDays,
          className: 'bg-amber-50 text-amber-600',
        },
        {
          label: 'Notifications',
          value: data.unreadNotificationCount,
          hint: 'Unread',
          href: '/staff/notifications',
          icon: FileText,
          className: 'bg-sky-50 text-sky-600',
        },
      ];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            {photoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoSrc}
                alt=""
                className="h-20 w-20 rounded-xl border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-sky-100 text-2xl font-semibold text-sky-700">
                {profile.fullName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">{profile.fullName}</h1>
                {profile.status?.toUpperCase() === 'ACTIVE' ? (
                  <BadgeCheck className="h-5 w-5 text-sky-500" />
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                <span className="font-medium text-slate-700">{profile.employeeCode}</span>
                {profile.designation ? ` · ${profile.designation}` : ''}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {[
                  profile.department
                    ? /^department\b/i.test(profile.department)
                      ? profile.department
                      : `Department of ${profile.department}`
                    : null,
                  profile.institutionName,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                {profile.email ? (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {profile.email}
                  </span>
                ) : null}
                {profile.mobile ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {profile.mobile}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                  {staffTypeLabel(profile.staffType)}
                </span>
                {profile.isTeaching ? (
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                    Faculty
                  </span>
                ) : null}
                {profile.department ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {profile.department}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
            <Link
              href="/staff/profile?tab=personal&edit=1"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700"
            >
              <Pencil className="h-4 w-4" /> Edit Profile
            </Link>
            <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-[280px]">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-400">Academic Year</p>
                <p className="font-semibold text-slate-800">{academicContext.session ?? '—'}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-400">Cycle</p>
                <p className="font-semibold text-slate-800">{academicContext.cycle || '—'}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-400">Active Semesters</p>
                <p className="font-semibold text-slate-800">
                  {formatSemesters(academicContext.activeSemesters)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                  {card.value}
                </p>
                <p className="mt-1 text-xs font-medium text-sky-600">{card.hint}</p>
              </div>
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl',
                  card.className,
                )}
              >
                <card.icon className="h-5 w-5" />
              </span>
            </div>
          </Link>
        ))}
      </section>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-2 shadow-sm">
        <div className="flex min-w-max">
          {TABS.map((tab) => {
            const active = tab.href === '/staff/dashboard';
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'border-b-2 px-3 py-3 text-sm font-medium',
                  active
                    ? 'border-[#1d4ed8] text-[#1d4ed8]'
                    : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Today&apos;s Schedule</h2>
            <span className="text-xs text-slate-400">{todayLabel}</span>
          </div>
          {todaySlots.length === 0 ? (
            <p className="py-8 text-sm text-slate-500">No classes scheduled for today.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {todaySlots.map((slot) => {
                const kind = classKind(slot);
                return (
                  <li key={slot.id} className="flex items-center gap-3 py-3">
                    <span className="w-24 shrink-0 text-xs font-medium text-slate-500">
                      {clock(slot.startTime)} – {clock(slot.endTime)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {slot.subject}
                        {slot.semesterNo ? ` · Sem ${slot.semesterNo}` : ''}
                      </p>
                      {slot.attendancePending ? (
                        <p className="text-xs font-medium text-rose-600">Attendance pending</p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        kindClass(kind),
                      )}
                    >
                      {kind}
                    </span>
                    {slot.classroom ? (
                      <span className="hidden items-center gap-1 text-xs text-slate-400 sm:inline-flex">
                        <MapPin className="h-3 w-3" /> {slot.classroom}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Upcoming Classes</h2>
            <Link href="/staff/calendar" className="text-xs font-medium text-sky-600">
              View Calendar
            </Link>
          </div>
          {upcomingSlots.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {upcomingSlots.map((slot, index) => {
                const badge = dateBadge(slot.classDate);
                return (
                  <li key={slot.id} className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-[10px] font-semibold',
                        [
                          'bg-rose-50 text-rose-600',
                          'bg-amber-50 text-amber-700',
                          'bg-sky-50 text-sky-700',
                          'bg-emerald-50 text-emerald-700',
                        ][index % 4],
                      )}
                    >
                      <span className="text-sm leading-none">{badge.day}</span>
                      {badge.month}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {slot.subject}
                        {slot.semesterNo ? ` · Sem ${slot.semesterNo}` : ''}
                      </p>
                      <p className="text-xs text-slate-400">
                        <Clock3 className="mr-1 inline h-3 w-3" />
                        {clock(slot.startTime)} – {clock(slot.endTime)}
                      </p>
                    </div>
                    {slot.classroom ? (
                      <span className="text-xs text-slate-400">{slot.classroom}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : upcomingEvents.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {upcomingEvents.map((event) => {
                const badge = dateBadge(event.date);
                return (
                  <li key={event.id} className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 text-[10px] font-semibold text-slate-600">
                      <span className="text-sm leading-none">{badge.day}</span>
                      {badge.month}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{event.title}</p>
                      <p className="text-xs text-slate-400">{event.subtitle || event.type}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-8 text-sm text-slate-500">No upcoming classes on the calendar.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-3">
          <h2 className="font-semibold text-slate-900">Quick Actions</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {actions.map((action) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                className="flex items-center gap-2 rounded-xl border border-slate-100 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-lg',
                    action.className,
                  )}
                >
                  <action.icon className="h-3.5 w-3.5" />
                </span>
                {action.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Profile Completion</h2>
              <p className="text-xs text-slate-400">
                Complete your profile for a better experience
              </p>
            </div>
            <Link
              href="/staff/profile?tab=personal&edit=1"
              className="rounded-lg bg-[#1d4ed8] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Complete Profile
            </Link>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${completion}%` }} />
          </div>
          <p className="mt-1 text-right text-sm font-semibold text-slate-700">{completion}%</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {checks.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600"
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    item.done ? 'bg-emerald-500' : 'bg-slate-300',
                  )}
                />
                {item.label}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Activity</h2>
            <Link href="/staff/notifications" className="text-xs font-medium text-sky-600">
              View All
            </Link>
          </div>
          {data.notifications.length === 0 ? (
            <p className="py-8 text-sm text-slate-500">No recent activity.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.notifications.slice(0, 4).map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
                    {item.body ? (
                      <p className="truncate text-xs text-slate-400">{item.body}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {relativeTime(item.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
