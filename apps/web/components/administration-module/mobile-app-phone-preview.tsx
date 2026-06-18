'use client';

import Link from 'next/link';
import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Home,
  LayoutDashboard,
  User,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

const STUDENT_CARD_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  attendance: {
    label: 'Attendance',
    icon: ClipboardList,
    color: 'from-cyan-500/20 to-cyan-600/10 text-cyan-700',
  },
  fees: { label: 'Fees', icon: Wallet, color: 'from-amber-500/20 to-amber-600/10 text-amber-700' },
  timetable: {
    label: 'Timetable',
    icon: CalendarDays,
    color: 'from-violet-500/20 to-violet-600/10 text-violet-700',
  },
  results: {
    label: 'Results',
    icon: GraduationCap,
    color: 'from-emerald-500/20 to-emerald-600/10 text-emerald-700',
  },
  library: {
    label: 'Library',
    icon: BookOpen,
    color: 'from-sky-500/20 to-sky-600/10 text-sky-700',
  },
  hostel: {
    label: 'Hostel',
    icon: Home,
    color: 'from-orange-500/20 to-orange-600/10 text-orange-700',
  },
  notifications: {
    label: 'Alerts',
    icon: Bell,
    color: 'from-rose-500/20 to-rose-600/10 text-rose-700',
  },
  lms: {
    label: 'LMS',
    icon: GraduationCap,
    color: 'from-indigo-500/20 to-indigo-600/10 text-indigo-700',
  },
  examinations: {
    label: 'Exams',
    icon: ClipboardList,
    color: 'from-fuchsia-500/20 to-fuchsia-600/10 text-fuchsia-700',
  },
};

const STAFF_CARD_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  todayClasses: {
    label: "Today's Classes",
    icon: CalendarDays,
    color: 'from-violet-500/20 to-violet-600/10 text-violet-700',
  },
  pendingAttendance: {
    label: 'Attendance Due',
    icon: ClipboardList,
    color: 'from-amber-500/20 to-amber-600/10 text-amber-700',
  },
  leaveBalance: {
    label: 'Leave Balance',
    icon: User,
    color: 'from-emerald-500/20 to-emerald-600/10 text-emerald-700',
  },
  payroll: { label: 'Payroll', icon: Wallet, color: 'from-sky-500/20 to-sky-600/10 text-sky-700' },
  notifications: {
    label: 'Notifications',
    icon: Bell,
    color: 'from-rose-500/20 to-rose-600/10 text-rose-700',
  },
  timetable: {
    label: 'Timetable',
    icon: LayoutDashboard,
    color: 'from-cyan-500/20 to-cyan-600/10 text-cyan-700',
  },
};

const STUDENT_NAV = [
  { label: 'Home', icon: LayoutDashboard },
  { label: 'Attendance', icon: ClipboardList },
  { label: 'LMS', icon: GraduationCap },
  { label: 'Fees', icon: Wallet },
  { label: 'Profile', icon: User },
];

const STAFF_NAV = [
  { label: 'Home', icon: LayoutDashboard },
  { label: 'Classes', icon: CalendarDays },
  { label: 'LMS', icon: GraduationCap },
  { label: 'Leave', icon: User },
  { label: 'More', icon: Bell },
];

function PhoneFrame({
  appName,
  children,
  navItems,
}: {
  appName: string;
  children: React.ReactNode;
  navItems: { label: string; icon: LucideIcon }[];
}) {
  return (
    <div className="mx-auto w-[280px] shrink-0">
      <div className="rounded-[2rem] border-[6px] border-slate-800 bg-slate-900 p-2 shadow-2xl shadow-slate-900/40">
        <div className="relative overflow-hidden rounded-[1.4rem] bg-background">
          {/* Status bar */}
          <div className="flex items-center justify-between bg-gradient-to-r from-primary/10 to-violet-500/10 px-4 py-2 text-[10px] text-muted-foreground">
            <span>9:41</span>
            <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900/90" />
            <span>100%</span>
          </div>

          {/* App header */}
          <div className="border-b border-border/60 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              OneCampus
            </p>
            <p className="text-sm font-bold">{appName}</p>
          </div>

          {/* Scrollable content */}
          <div className="max-h-[420px] overflow-y-auto px-2.5 py-2.5">{children}</div>

          {/* Bottom nav */}
          <div className="flex items-center justify-around border-t border-border/60 bg-card/95 px-1 py-2">
            {navItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={cn(
                    'flex flex-col items-center gap-0.5 text-[9px]',
                    i === 0 ? 'text-primary font-semibold' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewCards({
  cards,
  meta,
  config,
}: {
  cards: readonly string[];
  meta: Record<string, { label: string; icon: LucideIcon; color: string }>;
  config: Record<string, boolean>;
}) {
  const enabled = cards.filter((key) => config[key] !== false);

  return (
    <div className="grid grid-cols-2 gap-2">
      {enabled.map((key) => {
        const m = meta[key];
        if (!m) return null;
        const Icon = m.icon;
        return (
          <div
            key={key}
            className={cn('rounded-xl border border-border/50 bg-gradient-to-br p-2.5', m.color)}
          >
            <Icon className="mb-1 h-4 w-4 opacity-80" />
            <p className="text-[11px] font-semibold leading-tight">{m.label}</p>
            <p className="mt-0.5 text-[9px] opacity-70">Tap to open</p>
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  studentAppName: string;
  staffAppName: string;
  studentConfig: Record<string, boolean>;
  staffConfig: Record<string, boolean>;
  studentCards: readonly string[];
  staffCards: readonly string[];
  primaryColor?: string;
};

export function MobileAppPhonePreview({
  studentAppName,
  staffAppName,
  studentConfig,
  staffConfig,
  studentCards,
  staffCards,
  primaryColor,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Preview how home screens look on a phone. Toggle cards in the Student / Staff tabs to
          update this preview.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/student" target="_blank">
              Open live student portal
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/staff/dashboard" target="_blank">
              Open live staff portal
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-10 rounded-2xl border border-border/80 bg-muted/30 p-6">
        <div className="text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Student App
          </p>
          <PhoneFrame appName={studentAppName} navItems={STUDENT_NAV}>
            <div
              className="mb-2 rounded-xl border border-border/40 bg-gradient-to-br from-primary/10 to-violet-500/5 p-2.5 text-center"
              style={primaryColor ? { borderColor: `${primaryColor}40` } : undefined}
            >
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                ST
              </div>
              <p className="mt-1.5 text-xs font-bold">Demo Student</p>
              <p className="text-[10px] text-muted-foreground">B.A. Semester 3 · Morning</p>
            </div>
            <PreviewCards cards={studentCards} meta={STUDENT_CARD_META} config={studentConfig} />
          </PhoneFrame>
        </div>

        <div className="text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Staff App
          </p>
          <PhoneFrame appName={staffAppName} navItems={STAFF_NAV}>
            <div className="mb-2 rounded-xl border border-border/40 bg-gradient-to-br from-primary/10 to-cyan-500/5 p-2.5 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                DR
              </div>
              <p className="mt-1.5 text-xs font-bold">Dr. Demo Faculty</p>
              <p className="text-[10px] text-muted-foreground">Computer Science · HOD</p>
            </div>
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              {['Attendance', 'Timetable', 'LMS', 'Students'].map((label) => (
                <div
                  key={label}
                  className="rounded-lg border border-border/50 bg-card/80 py-2 text-center text-[10px] font-medium"
                >
                  {label}
                </div>
              ))}
            </div>
            <PreviewCards cards={staffCards} meta={STAFF_CARD_META} config={staffConfig} />
          </PhoneFrame>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Tip: On desktop, resize the browser window below 768px wide or use DevTools device mode to
        see the full responsive mobile layout with real data.
      </p>
    </div>
  );
}
