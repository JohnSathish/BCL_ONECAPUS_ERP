'use client';

import { motion } from 'framer-motion';
import { CalendarDays, CheckSquare, ClipboardList, GraduationCap, Wallet } from 'lucide-react';

import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import { DirectoryKpiSkeleton } from '@/components/students-module/directory/ui/directory-skeleton';
import { staffTypeLabel } from '@/components/staff-module/directory/staff-filter-utils';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { StaffDashboardData } from '@/types/staff-portal';
import { cn } from '@/utils/cn';

type Props = {
  data?: StaffDashboardData;
  loading?: boolean;
};

function formatSemesters(semesters: number[]) {
  if (!semesters.length) return '—';
  return semesters.map((s) => `Sem ${s}`).join(', ');
}

function getLocalGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function StaffDashboardHeader({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="animate-pulse rounded-2xl border border-border/40 bg-card/60 p-6">
        <div className="h-6 w-48 rounded bg-muted" />
        <div className="mt-3 h-4 w-72 rounded bg-muted" />
      </div>
    );
  }

  const { profile, academicContext } = data;
  const photoSrc = profile.photoUrl ? resolveUploadAssetUrl(profile.photoUrl) : null;
  const greeting = getLocalGreeting();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden rounded-2xl border border-border/40 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="relative shrink-0">
            {photoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoSrc}
                alt=""
                className="h-16 w-16 rounded-2xl border border-border/60 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
                {profile.fullName.charAt(0)}
              </div>
            )}
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background',
                profile.online ? 'bg-emerald-500' : 'bg-muted-foreground/40',
              )}
              title={profile.online ? 'Online' : 'Offline'}
            />
          </div>

          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {greeting}, {profile.fullName}
            </h1>
            <p className="mt-0.5 font-mono text-sm text-muted-foreground">{profile.employeeCode}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {[profile.designation, profile.department].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {profile.institutionName ?? profile.campusName}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {staffTypeLabel(profile.staffType)}
              </span>
              {profile.isHod ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  HOD
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="shrink-0 rounded-xl border border-border/50 bg-background/50 px-4 py-3 text-right text-sm backdrop-blur-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Academic Session
          </p>
          <p className="font-semibold">{academicContext.session ?? '—'}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Cycle: <span className="font-medium text-foreground">{academicContext.cycle}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Semesters:{' '}
            <span className="font-medium text-foreground">
              {formatSemesters(academicContext.activeSemesters)}
            </span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}

type KpiCardProps = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  children: React.ReactNode;
  delay?: number;
};

function KpiCard({ title, icon: Icon, gradient, children, delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.2 }}
      className={cn(
        'glass-card min-w-[160px] flex-1 overflow-hidden rounded-[20px] border border-border/40 p-4',
        'bg-gradient-to-br shadow-sm',
        gradient,
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/40 text-primary backdrop-blur-sm">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      </div>
      <div className="mt-3 space-y-1 text-sm">{children}</div>
    </motion.div>
  );
}

export function StaffSnapshotCards({ data, loading }: Props) {
  if (loading || !data) return <DirectoryKpiSkeleton />;

  const { kpis } = data;
  const todayClasses = data.todaySchedule?.length ?? 0;

  if (data.profile.isTeaching) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          title="Today's Classes"
          icon={GraduationCap}
          gradient="from-violet-500/10 via-violet-500/5 to-transparent"
          delay={0}
        >
          <p className="text-2xl font-bold">
            <AnimatedCounter value={todayClasses} />
          </p>
        </KpiCard>
        <KpiCard
          title="Weekly Workload"
          icon={CalendarDays}
          gradient="from-sky-500/10 via-sky-500/5 to-transparent"
          delay={0.05}
        >
          <p className="text-2xl font-bold">
            <AnimatedCounter value={kpis.teachingLoad.weeklyClasses} />{' '}
            <span className="text-sm font-normal">
              /{' '}
              {kpis.teachingLoad.weeklyWorkloadTarget ??
                Math.max(kpis.teachingLoad.weeklyClasses, 18)}{' '}
              Hours
            </span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-primary"
              style={{
                width: `${kpis.teachingLoad.weeklyWorkloadPercent ?? Math.min(100, Math.round((kpis.teachingLoad.weeklyClasses / Math.max(kpis.teachingLoad.weeklyWorkloadTarget ?? 18, 1)) * 100))}%`,
              }}
            />
          </div>
        </KpiCard>
        <KpiCard
          title="Assigned Subjects"
          icon={GraduationCap}
          gradient="from-emerald-500/10 via-emerald-500/5 to-transparent"
          delay={0.1}
        >
          <p className="text-2xl font-bold">
            <AnimatedCounter value={kpis.teachingLoad.assignedSubjects} />
          </p>
        </KpiCard>
        <KpiCard
          title="Attendance Pending"
          icon={ClipboardList}
          gradient="from-amber-500/10 via-amber-500/5 to-transparent"
          delay={0.15}
        >
          <p className="text-2xl font-bold">
            <AnimatedCounter value={kpis.tasks.attendancePending} />
            <span className="text-sm font-normal"> Classes</span>
          </p>
        </KpiCard>
        <KpiCard
          title="LMS Pending"
          icon={CheckSquare}
          gradient="from-rose-500/10 via-rose-500/5 to-transparent"
          delay={0.2}
        >
          <p className="text-2xl font-bold">
            <AnimatedCounter value={kpis.tasks.lmsPendingEvaluations} />
            <span className="text-sm font-normal"> Assignments</span>
          </p>
        </KpiCard>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
      <KpiCard
        title="Attendance"
        icon={ClipboardList}
        gradient="from-emerald-500/10 via-emerald-500/5 to-transparent"
        delay={0}
      >
        <p>
          Present:{' '}
          <strong>
            <AnimatedCounter value={kpis.attendance.presentDays} />
          </strong>
        </p>
        <p className="text-muted-foreground">
          Late {kpis.attendance.late} · Absent {kpis.attendance.absent}
        </p>
        <p className="text-lg font-bold">
          <AnimatedCounter value={kpis.attendance.percentage} suffix="%" />
        </p>
      </KpiCard>

      {data.profile.isTeaching ? (
        <KpiCard
          title="Teaching Load"
          icon={GraduationCap}
          gradient="from-violet-500/10 via-violet-500/5 to-transparent"
          delay={0.05}
        >
          <p>
            Subjects: <strong>{kpis.teachingLoad.assignedSubjects}</strong> · Sections:{' '}
            <strong>{kpis.teachingLoad.sections}</strong>
          </p>
          <p className="text-muted-foreground">
            Weekly classes: {kpis.teachingLoad.weeklyClasses} · Credits: {kpis.teachingLoad.credits}
          </p>
        </KpiCard>
      ) : null}

      <KpiCard
        title="Leave Balance"
        icon={CalendarDays}
        gradient="from-sky-500/10 via-sky-500/5 to-transparent"
        delay={0.1}
      >
        <p>
          CL <strong>{kpis.leave.casual}</strong> · SL <strong>{kpis.leave.sick}</strong> · EL{' '}
          <strong>{kpis.leave.earned}</strong>
        </p>
        <p className="text-muted-foreground">Pending: {kpis.leave.pendingRequests}</p>
      </KpiCard>

      <KpiCard
        title="Salary Snapshot"
        icon={Wallet}
        gradient="from-amber-500/10 via-amber-500/5 to-transparent"
        delay={0.15}
      >
        <p className="text-lg font-bold">
          ₹<AnimatedCounter value={kpis.salary.currentMonthSalary} />
        </p>
        <p className="text-muted-foreground">
          {kpis.salary.payslipAvailable ? 'Payslip available' : 'Payslip pending'}
        </p>
      </KpiCard>

      <KpiCard
        title="Tasks"
        icon={CheckSquare}
        gradient="from-rose-500/10 via-rose-500/5 to-transparent"
        delay={0.2}
      >
        {data.profile.isTeaching ? (
          <>
            <p>Pending lesson plans: {kpis.tasks.pendingLessonPlans}</p>
            <p>Attendance pending: {kpis.tasks.attendancePending}</p>
            <p>Exam duty: {kpis.tasks.examDutyAssigned}</p>
          </>
        ) : null}
        {kpis.tasks.approvalRequests > 0 ? (
          <p>Approval requests: {kpis.tasks.approvalRequests}</p>
        ) : null}
        {!data.profile.isTeaching && kpis.tasks.approvalRequests === 0 ? (
          <p className="text-muted-foreground">No pending tasks</p>
        ) : null}
      </KpiCard>
    </div>
  );
}
