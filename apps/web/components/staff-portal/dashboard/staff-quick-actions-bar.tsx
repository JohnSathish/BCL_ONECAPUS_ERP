'use client';

import Link from 'next/link';
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Download,
  FileText,
  GraduationCap,
  LayoutDashboard,
} from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';

const ACTIONS = [
  { label: 'Take Attendance', href: '/staff/academic/attendance-entry', icon: ClipboardList },
  { label: 'Open Timetable', href: '/staff/academic/timetable', icon: CalendarDays },
  { label: 'Upload Lesson Plan', href: '/staff/academic/lesson-plans', icon: FileText },
  { label: 'Apply Leave', href: '/staff/leave', icon: BookOpen },
  { label: 'Download Payslip', href: '/staff/salary', icon: Download },
  { label: 'View Subjects', href: '/staff/academic/subjects', icon: GraduationCap },
  { label: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard },
];

export function StaffQuickActionsBar({ isTeaching }: { isTeaching?: boolean }) {
  const items = isTeaching
    ? ACTIONS
    : ACTIONS.filter(
        (a) => !['Take Attendance', 'Upload Lesson Plan', 'View Subjects'].includes(a.label),
      );

  return (
    <div className="sticky top-0 z-20 -mx-1 mb-4 border-b border-border/40 bg-background/80 px-1 py-2 backdrop-blur-xl">
      <div className="flex gap-2 overflow-x-auto scrollbar-thin">
        {items.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href + action.label}
              href={action.href}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'h-8 shrink-0 gap-1.5 rounded-xl border-border/60 bg-card/60 text-xs backdrop-blur-sm',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {action.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
