'use client';

import {
  Building2,
  Calendar,
  Headset,
  KeyRound,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LicenseActivationKeyForm } from '@/components/licensing/license-activation-key-form';
import { ModuleEntitlementsPanel } from '@/components/licensing/module-entitlements-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchLicenseDetails, type LicenseStatus } from '@/services/licensing';
import { cn } from '@/utils/cn';
import { formatDisplayDate, formatDisplayDateTime } from '@/utils/format-date';

const STATUS_LABELS: Record<LicenseStatus, string> = {
  ACTIVE: 'Active',
  NEAR_EXPIRY: 'Near Expiry',
  GRACE_PERIOD: 'Grace Period',
  EXPIRED: 'Expired',
  SUSPENDED: 'Suspended',
};

const STATUS_PILL: Record<LicenseStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  NEAR_EXPIRY: 'bg-amber-100 text-amber-900',
  GRACE_PERIOD: 'bg-orange-100 text-orange-900',
  EXPIRED: 'bg-red-100 text-red-800',
  SUSPENDED: 'bg-slate-200 text-slate-700',
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
  const qc = useQueryClient();
  const details = useQuery({
    queryKey: ['license', 'details'],
    queryFn: fetchLicenseDetails,
    enabled,
  });

  function refreshLicense() {
    void qc.invalidateQueries({ queryKey: ['license'] });
  }

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
  const status = hasLicense && 'status' in data ? data.status : null;
  const validTill =
    hasLicense && 'expiryDate' in data && data.expiryDate
      ? formatDisplayDate(data.expiryDate)
      : hasLicense
        ? 'Lifetime'
        : '—';
  const institutionName =
    hasLicense && 'institutionName' in data ? data.institutionName : 'Institution';
  const licenseType = hasLicense && 'licenseType' in data ? data.licenseType : '—';
  const plan =
    hasLicense && 'subscriptionPlan' in data ? data.subscriptionPlan : 'ERP Subscription';
  const startDate = hasLicense && 'startDate' in data ? formatDisplayDateTime(data.startDate) : '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20">
            <Shield className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">License</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Manage your institution license, modules and subscription details.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                License Status
              </p>
              <div className="mt-1.5">
                {status ? (
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      STATUS_PILL[status],
                    )}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    Not activated
                  </span>
                )}
              </div>
            </div>
            <div className="border-l border-slate-100 pl-6">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Valid Till
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {validTill}
              </p>
            </div>
          </div>
        </div>
      </div>

      <LicenseActivationKeyForm onActivated={refreshLicense} />

      <ModuleEntitlementsPanel />

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

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <MetaCell
          icon={Calendar}
          label="Activation Date"
          primary={startDate}
          secondary={hasLicense && 'licenseNumber' in data ? data.licenseNumber : undefined}
        />
        <MetaCell
          icon={UserRound}
          label="Activated By"
          primary="—"
          secondary="Tracked on key redemption"
        />
        <MetaCell icon={KeyRound} label="License Type" primary={licenseType} secondary={plan} />
        <MetaCell
          icon={Building2}
          label="Institution"
          primary={institutionName}
          secondary={undefined}
        />
        <MetaCell
          icon={Headset}
          label="Support"
          primary={data.renewalContact.email}
          secondary={data.renewalContact.mobile}
        />
      </div>

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

function MetaCell({
  icon: Icon,
  label,
  primary,
  secondary,
}: {
  icon: typeof Calendar;
  label: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{primary}</p>
        {secondary ? <p className="truncate text-xs text-slate-500">{secondary}</p> : null}
      </div>
    </div>
  );
}
