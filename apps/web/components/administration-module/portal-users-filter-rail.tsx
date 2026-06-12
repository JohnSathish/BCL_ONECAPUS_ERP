'use client';

import type { PortalUserFilters } from '@/types/administration';
import { cn } from '@/utils/cn';
import { AdminGlassCard } from './ui/admin-shell';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'blocked', label: 'Blocked' },
];

export function PortalUsersFilterRail({
  filters,
  roles,
  onChange,
}: {
  filters: PortalUserFilters;
  roles: { slug: string; name: string }[];
  onChange: (next: PortalUserFilters) => void;
}) {
  const chip = (active: boolean) =>
    cn(
      'rounded-full px-3 py-1.5 text-xs font-medium transition',
      active
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'bg-muted/60 text-muted-foreground hover:bg-muted',
    );

  return (
    <AdminGlassCard className="flex flex-wrap items-center gap-2 p-3">
      <select
        className="h-8 rounded-full border-0 bg-muted/60 px-3 text-xs"
        value={filters.role ?? ''}
        onChange={(e) => onChange({ ...filters, role: e.target.value || undefined, page: 1 })}
      >
        <option value="">All roles</option>
        {roles.map((r) => (
          <option key={r.slug} value={r.slug}>
            {r.name}
          </option>
        ))}
      </select>
      {STATUS_OPTIONS.map((s) => (
        <button
          key={s.value || 'all'}
          type="button"
          className={chip(filters.status === s.value || (!filters.status && !s.value))}
          onClick={() => onChange({ ...filters, status: s.value || undefined, page: 1 })}
        >
          {s.label}
        </button>
      ))}
    </AdminGlassCard>
  );
}
