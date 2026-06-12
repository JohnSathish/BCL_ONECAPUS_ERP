'use client';

import { Mail, Phone, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { LicenseActivationKeyForm } from '@/components/licensing/license-activation-key-form';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchLicenseDetails, type LicenseStatus } from '@/services/licensing';
import { cn } from '@/utils/cn';

const STATUS_LABELS: Record<LicenseStatus, string> = {
  ACTIVE: 'Active',
  NEAR_EXPIRY: 'Near Expiry',
  GRACE_PERIOD: 'Grace Period',
  EXPIRED: 'Expired',
  SUSPENDED: 'Suspended',
};

function UsageBar({ label, current, max }: { label: string; current: number; max: number | null }) {
  const pct = max && max > 0 ? Math.min(Math.round((current / max) * 100), 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {current.toLocaleString()}
          {max ? ` / ${max.toLocaleString()}` : ''}
        </span>
      </div>
      {max ? <Progress value={pct} className="h-2" /> : null}
    </div>
  );
}

export function LicenseDetailsPage() {
  const enabled = useAuthQueryEnabled();
  const details = useQuery({
    queryKey: ['license', 'details'],
    queryFn: fetchLicenseDetails,
    enabled,
  });

  if (details.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading license details…</p>;
  }

  if (details.isError || !details.data) {
    return (
      <p className="text-sm text-destructive">
        Unable to load license details. Contact your administrator if this persists.
      </p>
    );
  }

  const data = details.data;
  const hasLicense = data.hasLicense !== false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Institution License</h2>
        <p className="text-sm text-muted-foreground">
          View subscription status or activate a license key from BaseCode Labs.
        </p>
      </div>

      <LicenseActivationKeyForm />

      {!hasLicense ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No active license is configured. Enter an activation key above or contact BaseCode Labs.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4" />
                  License Overview
                </CardTitle>
                <CardDescription>
                  {'licenseNumber' in data ? data.licenseNumber : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium">{STATUS_LABELS[data.status]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Plan</p>
                  <p className="font-medium">{data.subscriptionPlan}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Start date</p>
                  <p className="font-medium">{new Date(data.startDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Expiry date</p>
                  <p className="font-medium">
                    {data.expiryDate ? new Date(data.expiryDate).toLocaleDateString() : 'Lifetime'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Days remaining</p>
                  <p
                    className={cn(
                      'font-medium',
                      data.daysRemaining !== null && data.daysRemaining <= 30 && 'text-amber-600',
                    )}
                  >
                    {data.daysRemaining === null ? '—' : data.daysRemaining}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Grace period</p>
                  <p className="font-medium">{data.gracePeriodDays} days</p>
                </div>
                {data.expiryDate ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Term progress</span>
                      <span>{data.progressPercent}%</span>
                    </div>
                    <Progress value={data.progressPercent} className="h-2" />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Usage</CardTitle>
                <CardDescription>Current consumption vs entitlement limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <UsageBar
                  label="Students"
                  current={data.usage.currentStudents}
                  max={data.limits.maxStudents}
                />
                <UsageBar
                  label="Staff"
                  current={data.usage.currentStaff}
                  max={data.limits.maxStaff}
                />
                <UsageBar
                  label="Storage (MB)"
                  current={data.usage.fileStorageMb}
                  max={data.limits.storageLimitMb}
                />
              </CardContent>
            </Card>
          </div>

          {'renewalHistory' in data && data.renewalHistory.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Renewal history</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Renewed</th>
                        <th className="pb-2 pr-4 font-medium">Previous expiry</th>
                        <th className="pb-2 pr-4 font-medium">New expiry</th>
                        <th className="pb-2 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.renewalHistory.map((row) => (
                        <tr key={row.id} className="border-b border-border/50">
                          <td className="py-2 pr-4">
                            {new Date(row.renewedAt).toLocaleDateString()}
                          </td>
                          <td className="py-2 pr-4">
                            {row.previousExpiryDate
                              ? new Date(row.previousExpiryDate).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="py-2 pr-4">
                            {new Date(row.newExpiryDate).toLocaleDateString()}
                          </td>
                          <td className="py-2 text-muted-foreground">{row.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Renewal contact</CardTitle>
          <CardDescription>Contact BaseCode Labs to purchase or renew your license</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">{data.renewalContact.company}</p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            {data.renewalContact.mobile}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            {data.renewalContact.email}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
