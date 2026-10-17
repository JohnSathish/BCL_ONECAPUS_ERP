'use client';

import type { PortalUserFilters } from '@/types/administration';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'inactive', label: 'Inactive' },
];

const selectClass =
  'h-10 min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700';

export function PortalUsersFilterRail({
  filters,
  roles,
  departments,
  shifts,
  onChange,
  onReset,
}: {
  filters: PortalUserFilters;
  roles: { slug: string; name: string }[];
  departments: { id: string; name: string }[];
  shifts: { id: string; name: string }[];
  onChange: (next: PortalUserFilters) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={selectClass}
        value={filters.role ?? ''}
        onChange={(event) =>
          onChange({ ...filters, role: event.target.value || undefined, page: 1 })
        }
        aria-label="Role"
      >
        <option value="">All Roles</option>
        {roles.map((role) => (
          <option key={role.slug} value={role.slug}>
            {role.name}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={filters.departmentId ?? ''}
        onChange={(event) =>
          onChange({ ...filters, departmentId: event.target.value || undefined, page: 1 })
        }
        aria-label="Department"
      >
        <option value="">All Departments</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={filters.shiftId ?? ''}
        onChange={(event) =>
          onChange({ ...filters, shiftId: event.target.value || undefined, page: 1 })
        }
        aria-label="Shift"
      >
        <option value="">All Shifts</option>
        {shifts.map((shift) => (
          <option key={shift.id} value={shift.id}>
            {shift.name}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={filters.status ?? ''}
        onChange={(event) =>
          onChange({ ...filters, status: event.target.value || undefined, page: 1 })
        }
        aria-label="Status"
      >
        {STATUS_OPTIONS.map((status) => (
          <option key={status.value || 'all'} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="inline-flex h-10 items-center rounded-lg bg-[#1d4ed8] px-4 text-sm font-semibold text-white"
        onClick={() => onChange({ ...filters, page: 1 })}
      >
        Filter
      </button>
      <button
        type="button"
        className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600"
        onClick={onReset}
      >
        Reset
      </button>
    </div>
  );
}
