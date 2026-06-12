'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Clock,
  GraduationCap,
  MapPin,
  Megaphone,
  MessageSquare,
  Plus,
  Users,
} from 'lucide-react';

import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import { staffTypeLabel } from '@/components/staff-module/directory/staff-filter-utils';
import { StaffPortalAvatar } from '@/components/staff-portal/layout/staff-portal-avatar';
import { buttonVariants } from '@/components/ui/button';
import type { StaffDashboardData } from '@/types/staff-portal';
import { cn } from '@/utils/cn';
import { isCurrentTimeSlot, isPastTimeSlot } from '@/utils/student-portal-utils';

type Props = {
  data?: StaffDashboardData;
  loading?: boolean;
};

function MobileCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[18px] border border-border/40 bg-card/70 p-3 shadow-sm backdrop-blur-md',
        className,
      )}
    >
      {children}
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: 'Attendance', href: '/staff/academic/attendance-entry', icon: ClipboardList },
  { label: 'Timetable', href: '/staff/academic/timetable', icon: CalendarDays },
  { label: 'LMS', href: '/staff/academic/lms', icon: GraduationCap },
  { label: 'Students', href: '/staff/academic/subjects', icon: Users },
] as const;

export function StaffMobileDashboard({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="space-y-3 md:hidden">
        <div className="h-36 animate-pulse rounded-[18px] bg-muted/60" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[18px] bg-muted/60" />
          ))}
        </div>
        <div className="h-40 animate-pulse rounded-[18px] bg-muted/60" />
      </div>
    );
  }

  const {
    profile,
    academicContext,
    kpis,
    todaySchedule,
    lmsTasks,
    departmentNotices,
    performanceSnapshot,
  } = data;
  const safeLmsTasks = lmsTasks ?? {
    assignmentsToEvaluate: kpis.tasks.lmsPendingEvaluations,
    notesPendingUpload: kpis.tasks.pendingLessonPlans,
    discussionReplies: 0,
  };
  const safeNotices = departmentNotices ?? [];
  const safePerformance = performanceSnapshot ?? {
    classesThisWeek: Math.max(todaySchedule.length * 5, kpis.teachingLoad.weeklyClasses),
    attendanceSubmittedPercent:
      todaySchedule.length > 0
        ? Math.round(
            ((todaySchedule.length - kpis.tasks.attendancePending) / todaySchedule.length) * 100,
          )
        : 100,
    assignedSubjects: kpis.teachingLoad.assignedSubjects,
    studentsTaught: data.subjects.reduce((sum, s) => sum + s.studentCount, 0),
  };
  const attendancePending = kpis.tasks.attendancePending;
  const teachingLoad = kpis.teachingLoad;
  const workloadHours = teachingLoad.weeklyClasses;
  const workloadTarget = teachingLoad.weeklyWorkloadTarget ?? Math.max(workloadHours, 18);
  const workloadPercent =
    teachingLoad.weeklyWorkloadPercent ??
    (workloadTarget > 0 ? Math.min(100, Math.round((workloadHours / workloadTarget) * 100)) : 0);

  const firstPendingSection =
    todaySchedule.find((s) => s.offeringSectionId)?.offeringSectionId ?? null;
  const attendanceHref = firstPendingSection
    ? `/staff/academic/attendance-entry?section=${firstPendingSection}`
    : '/staff/academic/attendance-entry';

  return (
    <div className="relative space-y-3 pb-16 md:hidden">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-[20px] border border-border/40 bg-gradient-to-br from-primary/8 via-card/80 to-accent/5 p-3 shadow-sm backdrop-blur-md"
      >
        <div className="flex flex-col items-center text-center">
          <StaffPortalAvatar photoUrl={profile.photoUrl} name={profile.fullName} size="lg" />
          <h2 className="mt-2 text-base font-bold uppercase tracking-wide">{profile.fullName}</h2>
          <p className="text-sm text-muted-foreground">{profile.designation ?? 'Staff'}</p>
          {profile.department ? (
            <p className="text-xs text-muted-foreground">Department of {profile.department}</p>
          ) : null}
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            Employee ID: {profile.employeeCode}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {staffTypeLabel(profile.staffType)}
            </span>
            {profile.isHod ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                HOD
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-border/40 bg-background/50 px-3 py-2 text-center text-xs">
          <p className="font-medium uppercase tracking-wide text-muted-foreground">
            Academic Session
          </p>
          <p className="text-sm font-bold">{academicContext.session ?? '—'}</p>
          <p className="text-muted-foreground">
            Cycle: {academicContext.cycle}
            {academicContext.activeSemesters.length
              ? ` · Sem ${academicContext.activeSemesters.join(', Sem ')}`
              : ''}
          </p>
        </div>
      </motion.div>

      {profile.isTeaching ? (
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.div
                key={action.href}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  href={action.href}
                  className="flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-[16px] border border-border/50 bg-card/80 text-sm font-medium shadow-sm backdrop-blur transition active:scale-[0.98] hover:border-primary/30 hover:bg-primary/5"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  {action.label}
                </Link>
              </motion.div>
            );
          })}
        </div>
      ) : null}

      {profile.isTeaching ? (
        <MobileCard>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Today&apos;s Classes
            </h3>
            <Link href="/staff/academic/timetable" className="text-[11px] text-primary">
              Full timetable
            </Link>
          </div>
          {!todaySchedule.length ? (
            <p className="mt-2 text-sm text-muted-foreground">No classes scheduled for today.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {todaySchedule.map((slot) => {
                const isCurrent = isCurrentTimeSlot(slot.startTime, slot.endTime);
                const isPast = isPastTimeSlot(slot.endTime);
                return (
                  <li
                    key={slot.id}
                    className={cn(
                      'flex items-start gap-2 rounded-xl px-2.5 py-2',
                      isCurrent
                        ? 'border border-primary/40 bg-primary/10 shadow-[0_0_12px_hsl(var(--primary)/0.15)]'
                        : isPast
                          ? 'opacity-55'
                          : 'bg-background/40',
                    )}
                  >
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">{slot.startTime}</p>
                      <p className="text-sm font-semibold leading-tight">{slot.subject}</p>
                      {slot.classroom ? (
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {slot.classroom}
                        </p>
                      ) : null}
                    </div>
                    {isCurrent ? (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        Now
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </MobileCard>
      ) : null}

      {profile.isTeaching && attendancePending > 0 ? (
        <MobileCard className="border-amber-500/40 bg-amber-500/8">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Attendance Pending</p>
              <p className="text-xs text-muted-foreground">
                {attendancePending} {attendancePending === 1 ? 'Class Needs' : 'Classes Need'}{' '}
                Submission
              </p>
              <Link
                href={attendanceHref}
                className={cn(
                  buttonVariants({ size: 'sm' }),
                  'mt-2 h-11 min-h-[44px] w-full rounded-xl text-sm',
                )}
              >
                Submit Now
              </Link>
            </div>
          </div>
        </MobileCard>
      ) : null}

      {profile.isTeaching ? (
        <MobileCard>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Weekly Workload
            </p>
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-1 text-lg font-bold">
            <AnimatedCounter value={workloadHours} /> / {workloadTarget} Hours
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${workloadPercent}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            />
          </div>
          <p className="mt-1 text-right text-xs font-medium text-muted-foreground">
            {workloadPercent}%
          </p>
        </MobileCard>
      ) : null}

      {profile.isTeaching ? (
        <MobileCard>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Assigned Subjects
            </p>
            <Link href="/staff/academic/subjects" className="text-[11px] text-primary">
              View all
            </Link>
          </div>
          <p className="mt-1 text-2xl font-bold">
            <AnimatedCounter value={teachingLoad.assignedSubjects} />
          </p>
          <p className="text-xs text-muted-foreground">
            {teachingLoad.sections} section{teachingLoad.sections === 1 ? '' : 's'} ·{' '}
            {safePerformance.studentsTaught} students
          </p>
        </MobileCard>
      ) : null}

      {profile.isTeaching ? (
        <MobileCard>
          <div className="mb-2 flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              LMS Tasks
            </h3>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Assignments to Evaluate</span>
              <strong>{safeLmsTasks.assignmentsToEvaluate}</strong>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Notes Pending Upload</span>
              <strong>{safeLmsTasks.notesPendingUpload}</strong>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                Discussion Replies
              </span>
              <strong>{safeLmsTasks.discussionReplies}</strong>
            </li>
          </ul>
          <Link
            href="/staff/academic/lms"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'mt-3 h-11 min-h-[44px] w-full rounded-xl',
            )}
          >
            Open LMS
          </Link>
        </MobileCard>
      ) : null}

      {safeNotices.length > 0 ? (
        <MobileCard>
          <div className="mb-2 flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Department Announcements
            </h3>
          </div>
          <ul className="space-y-2">
            {safeNotices.map((notice) => (
              <li key={notice.id}>
                {notice.link ? (
                  <Link
                    href={notice.link}
                    className="block rounded-xl border border-border/40 bg-background/40 px-3 py-2 transition hover:border-primary/30"
                  >
                    <p className="text-sm font-medium">{notice.title}</p>
                    {notice.body ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {notice.body}
                      </p>
                    ) : null}
                  </Link>
                ) : (
                  <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                    <p className="text-sm font-medium">{notice.title}</p>
                    {notice.body ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {notice.body}
                      </p>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </MobileCard>
      ) : null}

      {profile.isTeaching ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Performance Snapshot
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Classes This Week', value: safePerformance.classesThisWeek },
              {
                label: 'Attendance Submitted',
                value: `${safePerformance.attendanceSubmittedPercent}%`,
              },
              { label: 'Assigned Subjects', value: safePerformance.assignedSubjects },
              { label: 'Students Taught', value: safePerformance.studentsTaught },
            ].map((item) => (
              <MobileCard key={item.label} className="p-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-0.5 text-lg font-bold">{item.value}</p>
              </MobileCard>
            ))}
          </div>
        </div>
      ) : null}

      {profile.isTeaching ? (
        <Link
          href={attendanceHref}
          className="fixed bottom-[4.5rem] right-4 z-30 flex h-12 min-h-[44px] items-center gap-2 rounded-full border border-primary/30 bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-95 md:hidden"
          aria-label="Take Attendance"
        >
          <Plus className="h-4 w-4" />
          Take Attendance
        </Link>
      ) : null}

      {!profile.isTeaching ? (
        <div className="grid grid-cols-2 gap-2">
          <MobileCard>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Attendance
            </p>
            <p className="mt-0.5 text-lg font-bold">{kpis.attendance.percentage}%</p>
            <p className="text-xs text-muted-foreground">
              Present {kpis.attendance.presentDays} · Absent {kpis.attendance.absent}
            </p>
          </MobileCard>
          <MobileCard>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Leave Balance
            </p>
            <p className="mt-0.5 text-lg font-bold">
              {kpis.leave.casual + kpis.leave.sick + kpis.leave.earned}
            </p>
            <p className="text-xs text-muted-foreground">CL · SL · EL combined</p>
          </MobileCard>
        </div>
      ) : null}
    </div>
  );
}
