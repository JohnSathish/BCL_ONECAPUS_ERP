'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { fetchLicenseSummary, type LicenseStatus } from '@/services/licensing';
import { cn } from '@/utils/cn';

const STATUS_LABELS: Record<LicenseStatus, string> = {
  ACTIVE: 'Active',
  NEAR_EXPIRY: 'Near Expiry',
  GRACE_PERIOD: 'Grace Period',
  EXPIRED: 'Expired',
  SUSPENDED: 'Suspended',
};

function severityVariant(severity: string, status: LicenseStatus) {
  if (status === 'SUSPENDED') return 'secondary';
  if (severity === 'red' || status === 'EXPIRED' || status === 'GRACE_PERIOD') return 'destructive';
  if (severity === 'orange' || severity === 'yellow') return 'outline';
  return 'secondary';
}

export function LicenseStatusBadge({ className }: { className?: string }) {
  const enabled = useAuthQueryEnabled();
  const { canAny } = usePermissions();
  const canView = canAny('license:read', 'tenant:manage', 'users:manage');

  const summary = useQuery({
    queryKey: ['license', 'summary'],
    queryFn: fetchLicenseSummary,
    staleTime: 60_000,
    enabled: enabled && canView,
  });

  if (!canView || !summary.data) return null;

  const { status, daysRemaining, severity, subscriptionPlan } = summary.data;
  const daysLabel =
    daysRemaining === null
      ? 'Lifetime'
      : daysRemaining >= 0
        ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
        : `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} overdue`;

  const warn = daysRemaining !== null && daysRemaining < 30;

  return (
    <Link
      href="/admin/administration/license"
      className={cn('inline-flex max-w-full items-center', className)}
      title={`${subscriptionPlan} — ${STATUS_LABELS[status]}`}
    >
      <Badge
        variant={severityVariant(severity, status)}
        className={cn(
          'gap-1.5 truncate font-normal',
          warn &&
            status === 'ACTIVE' &&
            'border-amber-500/60 bg-amber-500/10 text-amber-800 dark:text-amber-200',
        )}
      >
        <ShieldCheck className="h-3 w-3 shrink-0" />
        <span className="truncate">
          License: {STATUS_LABELS[status]} · {daysLabel}
        </span>
      </Badge>
    </Link>
  );
}
