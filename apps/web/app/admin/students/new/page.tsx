'use client';

import Link from 'next/link';

import { AddStudentWizard } from '@/components/students-module/add-student/add-student-wizard';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { buttonVariants } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { cn } from '@/utils/cn';

export default function AddStudentPage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Add Student">
      <div className="mb-2">
        <Link
          href="/admin/students"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-7 text-xs')}
        >
          ← Student directory
        </Link>
      </div>
      <AddStudentWizard />
    </DashboardShell>
  );
}
