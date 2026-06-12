'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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

function statusColor(status: LicenseStatus, severity: string) {
  if (status === 'SUSPENDED') return 'text-muted-foreground';
  if (status === 'EXPIRED' || status === 'GRACE_PERIOD') return 'text-destructive';
  if (severity === 'red' || severity === 'orange') return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

export function LicenseDashboardWidget() {
  const enabled = useAuthQueryEnabled();
  const { canAny } = usePermissions();
  const canView = canAny('license:read', 'tenant:manage', 'users:manage');

  const summary = useQuery({
    queryKey: ['license', 'summary'],
    queryFn: fetchLicenseSummary,
    staleTime: 60_000,
    enabled: enabled && canView,
  });

  if (!canView) return null;

  const data = summary.data;

  return (
    <Card className="col-span-12 lg:col-span-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              ERP License
            </CardTitle>
            <CardDescription>Subscription status for your institution</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/administration/license">Details</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.isLoading && !data ? (
          <p className="text-sm text-muted-foreground">Loading license…</p>
        ) : summary.isError || !data ? (
          <p className="text-sm text-muted-foreground">License information unavailable.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className={cn('font-medium', statusColor(data.status, data.severity))}>
                  {STATUS_LABELS[data.status]}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Plan</p>
                <p className="font-medium">{data.subscriptionPlan}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Expiry</p>
                <p className="font-medium">
                  {data.expiryDate ? new Date(data.expiryDate).toLocaleDateString() : 'Lifetime'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Remaining</p>
                <p className="font-medium">
                  {data.daysRemaining === null
                    ? '—'
                    : `${data.daysRemaining} day${data.daysRemaining === 1 ? '' : 's'}`}
                </p>
              </div>
            </div>
            {data.expiryDate ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Term progress</span>
                  <span>{data.progressPercent}%</span>
                </div>
                <Progress value={data.progressPercent} className="h-2" />
              </div>
            ) : null}
            {data.alertMessage ? (
              <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                {data.alertMessage}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
