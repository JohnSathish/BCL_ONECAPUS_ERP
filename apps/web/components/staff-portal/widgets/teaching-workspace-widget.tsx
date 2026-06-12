'use client';

import Link from 'next/link';
import { ClipboardList, FileText, GraduationCap, PenLine, Upload, Users } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';

const ACTIONS = [
  {
    label: 'Take Attendance',
    href: '/staff/academic/attendance-entry',
    icon: ClipboardList,
  },
  { label: 'Upload Notes', href: '/staff/academic/lms', icon: Upload },
  {
    label: 'Create Assignment',
    href: '/staff/academic/lms',
    icon: FileText,
  },
  { label: 'View Students', href: '/staff/academic/students', icon: Users },
  {
    label: 'Enter Marks',
    href: '/staff/academic/internal-marks',
    icon: PenLine,
  },
];

export function TeachingWorkspaceWidget({ isTeaching }: { isTeaching?: boolean }) {
  if (!isTeaching) return null;

  return (
    <GlassCard className="p-5 lg:col-span-2" glow>
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold tracking-tight">Teaching Workspace</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Quick access to daily teaching tasks</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'h-auto flex-col gap-2 rounded-xl border-border/50 bg-background/40 py-4 text-xs',
              )}
            >
              <Icon className="h-5 w-5 text-primary" />
              {action.label}
            </Link>
          );
        })}
      </div>
    </GlassCard>
  );
}
