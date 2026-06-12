'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import { cn } from '@/utils/cn';
import { buttonVariants } from '@/components/ui/button';
import Link from 'next/link';

export function StaffModulePlaceholder({
  title,
  heading,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  heading: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  useRequireStaffPortal();

  return (
    <DashboardShell role="staff" title={title}>
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {actionHref ? (
          <Link
            href={actionHref}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4')}
          >
            {actionLabel ?? 'Open'}
          </Link>
        ) : null}
      </GlassCard>
    </DashboardShell>
  );
}

export function StaffNotLinkedState() {
  return (
    <DashboardShell role="staff" title="Staff Portal">
      <GlassCard className="mx-auto max-w-lg p-8 text-center">
        <h2 className="text-lg font-semibold">Staff profile not linked</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your portal account is not linked to an employee record. Please contact HR or the
          administration office to activate your staff profile.
        </p>
      </GlassCard>
    </DashboardShell>
  );
}
