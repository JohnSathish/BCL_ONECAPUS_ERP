'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { GlassCard } from '@/components/erp/glass-card';
import { staffCategoryLabel } from '@/components/hr-module/pay-scale-utils';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchDesignations } from '@/services/staff';
import { STAFF_TYPES } from '@/types/staff';

const EXAMPLE_DESIGNATIONS = [
  'Principal',
  'Vice Principal',
  'Dean',
  'Assistant Professor',
  'Associate Professor',
  'Professor',
  'Librarian',
  'Accountant',
  'Office Assistant',
];

export function HrDesignationsPage() {
  const enabled = useAuthQueryEnabled();
  const [staffType, setStaffType] = useState('');

  const designationsQ = useQuery({
    queryKey: ['staff', 'designations', staffType],
    queryFn: () => fetchDesignations(staffType || undefined),
    enabled,
  });

  const grouped = useMemo(() => {
    const rows = designationsQ.data ?? [];
    const map = new Map<string, typeof rows>();
    for (const d of rows) {
      const key = d.category ?? 'GENERAL';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [designationsQ.data]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Designations</h2>
        <p className="text-sm text-muted-foreground">
          Job titles and ranks used across staff profiles, pay structures, and reporting.
        </p>
      </div>

      <GlassCard className="p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Common examples
        </p>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_DESIGNATIONS.map((label) => (
            <span
              key={label}
              className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 text-xs"
            >
              {label}
            </span>
          ))}
        </div>
      </GlassCard>

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          value={staffType}
          onChange={(e) => setStaffType(e.target.value)}
        >
          <option value="">All categories</option>
          {STAFF_TYPES.map((t) => (
            <option key={t} value={t}>
              {staffCategoryLabel(t)}
            </option>
          ))}
        </select>
      </div>

      {designationsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading designations…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {grouped.length ? (
            grouped.map(([type, items]) => (
              <GlassCard key={type} className="p-4">
                <h3 className="mb-3 font-semibold">
                  {staffCategoryLabel(type) !== type ? staffCategoryLabel(type) : type}
                </h3>
                <ul className="divide-y divide-border/60 text-sm">
                  {items.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2">
                      <span>{d.label}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {d.code ?? '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            ))
          ) : (
            <GlassCard className="p-6 text-center text-sm text-muted-foreground lg:col-span-2">
              No designations configured yet.
            </GlassCard>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Manage designation master data in{' '}
        <Link href="/admin/administration/support-data" className="text-primary underline">
          Administration → Support Data
        </Link>
        . Reporting structure (Principal → HODs) is configured under{' '}
        <Link href="/admin/staff/departments" className="text-primary underline">
          Departments
        </Link>
        .
      </p>
    </div>
  );
}
