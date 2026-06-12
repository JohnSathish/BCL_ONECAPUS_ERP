'use client';

import Link from 'next/link';
import { ArrowRight, CalendarCheck, Users } from 'lucide-react';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { buttonVariants } from '@/components/ui/button';
import type { MigrationStatusDto } from '@/services/students';
import { cn } from '@/utils/cn';

type Props = {
  status?: MigrationStatusDto | null;
};

export function AttendanceHandoffCard({ status }: Props) {
  if (!status?.readyForAttendance) return null;

  return (
    <CompactCard className="border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card to-card">
      <CompactCardHeader
        title="Ready for attendance"
        description="Registration is frozen for this batch. You can start marking attendance and continue fee setup."
      />
      <CompactCardBody className="space-y-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4 text-emerald-600" />
            <strong className="font-semibold text-foreground">{status.frozenCount}</strong>
            students locked
          </span>
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <CalendarCheck className="h-4 w-4 text-emerald-600" />
            {status.batchCode} · Sem {status.semesterSequence}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/academics/attendance"
            className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
          >
            Open attendance
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/admin/academics/timetable"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
          >
            Review timetable
          </Link>
          <Link
            href="/admin/students"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
          >
            Student directory
          </Link>
        </div>
      </CompactCardBody>
    </CompactCard>
  );
}
