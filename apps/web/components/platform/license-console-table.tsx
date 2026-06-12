'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchPlatformLicenses, type PlatformLicenseListItem } from '@/services/platform-licensing';
import type { LicenseStatus } from '@/services/licensing';
import { cn } from '@/utils/cn';

const STATUS_FILTERS: Array<{ value: LicenseStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'NEAR_EXPIRY', label: 'Near expiry' },
  { value: 'GRACE_PERIOD', label: 'Grace' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

function statusBadge(status: LicenseStatus | undefined) {
  if (!status) return <Badge variant="outline">No license</Badge>;
  const variant =
    status === 'EXPIRED' || status === 'SUSPENDED'
      ? 'destructive'
      : status === 'GRACE_PERIOD' || status === 'NEAR_EXPIRY'
        ? 'outline'
        : 'secondary';
  return <Badge variant={variant}>{status.replace('_', ' ')}</Badge>;
}

export function LicenseConsoleTable() {
  const enabled = useAuthQueryEnabled();
  const [status, setStatus] = useState<LicenseStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['platform', 'licenses', status, search],
    queryFn: () =>
      fetchPlatformLicenses({
        status: status === 'ALL' ? undefined : status,
        search: search.trim() || undefined,
      }),
    enabled,
  });

  const rows = useMemo(() => query.data?.items ?? [], [query.data?.items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">All institutions</h2>
          <p className="text-sm text-muted-foreground">{query.data?.total ?? 0} tenants</p>
        </div>
        <Input
          placeholder="Search institution or license no."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatus(f.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition',
              status === f.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted/50',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Institution</th>
              <th className="px-4 py-3 font-medium">License</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Expiry</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Days</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No institutions match your filters.
                </td>
              </tr>
            ) : (
              rows.map((row: PlatformLicenseListItem) => (
                <tr key={row.tenantId} className="border-t border-border/60 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <Link
                      href={`/platform/licenses/${row.tenantId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.institutionName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.license?.licenseNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3">{row.license?.subscriptionPlan ?? '—'}</td>
                  <td className="px-4 py-3">
                    {row.license?.expiryDate
                      ? new Date(row.license.expiryDate).toLocaleDateString()
                      : 'Lifetime'}
                  </td>
                  <td className="px-4 py-3">{statusBadge(row.license?.status)}</td>
                  <td className="px-4 py-3">{row.license?.daysRemaining ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
