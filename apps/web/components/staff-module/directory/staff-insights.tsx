'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import type { StaffDirectoryFilters } from '@/components/staff-module/directory/staff-filter-utils';
import type { EnhancedStaffSummary, StaffDirectoryRow } from '@/types/staff';
import { cn } from '@/utils/cn';

type Props = {
  summary?: EnhancedStaffSummary;
  rows: StaffDirectoryRow[];
  loading?: boolean;
  filters: StaffDirectoryFilters;
  onFilterChange: (patch: Partial<StaffDirectoryFilters>) => void;
};

function Donut({
  parts,
  center,
  caption,
}: {
  parts: { value: number; color: string }[];
  center: string;
  caption: string;
}) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  let cursor = 0;
  const gradient =
    total === 0
      ? 'var(--muted)'
      : `conic-gradient(${parts
          .map((part) => {
            const start = (cursor / total) * 100;
            cursor += part.value;
            const end = (cursor / total) * 100;
            return `${part.color} ${start}% ${end}%`;
          })
          .join(', ')})`;

  return (
    <div
      className="relative h-28 w-28 shrink-0 rounded-full"
      style={{ background: gradient }}
      aria-hidden
    >
      <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-background">
        <span className="text-xl font-bold tabular-nums">{center}</span>
        <span className="text-[10px] text-muted-foreground">{caption}</span>
      </div>
    </div>
  );
}

function Legend({
  items,
}: {
  items: { label: string; value: number; color: string; hint?: string }[];
}) {
  return (
    <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
      {items.map((item) => (
        <li key={item.label} className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', item.color)} />
            <span className="truncate">{item.label}</span>
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {item.value.toLocaleString('en-IN')}
            {item.hint ? ` (${item.hint})` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function StaffInsights({ summary, rows, loading, filters, onFilterChange }: Props) {
  const [showAllDepartments, setShowAllDepartments] = useState(false);
  const total = summary?.total ?? 0;
  const teaching = summary?.teaching ?? 0;
  const nonTeaching = summary?.nonTeaching ?? 0;
  const guest = summary?.guest ?? 0;
  const other = Math.max(0, total - teaching - nonTeaching - guest);
  const portalActive = summary?.activeAccounts ?? 0;
  const portalPending = summary?.pendingActivation ?? 0;
  const portalNone = Math.max(0, total - portalActive - portalPending);
  const share = (value: number, base: number) =>
    base > 0 ? `${Math.round((value / base) * 100)}%` : '0%';

  const departmentCounts = new Map<string, number>();
  let missingDepartment = 0;
  let missingRfid = 0;
  let teachingWithoutTimetable = 0;
  for (const row of rows) {
    const name = row.department?.trim();
    if (!name) missingDepartment += 1;
    else departmentCounts.set(name, (departmentCounts.get(name) ?? 0) + 1);
    if (!row.rfidNo?.trim()) missingRfid += 1;
    if (
      row.staffType === 'TEACHING' &&
      row.timetableSections === 0 &&
      row.subjectAssignments === 0
    ) {
      teachingWithoutTimetable += 1;
    }
  }
  const departments = [...departmentCounts.entries()].sort((a, b) => b[1] - a[1]);
  const visibleDepartments = showAllDepartments ? departments : departments.slice(0, 5);
  const maxDepartment = visibleDepartments[0]?.[1] ?? 1;
  const usingFullList = rows.length > 0 && rows.length >= total;

  const attention = [
    {
      label: 'Portal accounts pending',
      value: summary?.pendingActivation ?? 0,
      action: 'Review',
      active: filters.uiPortalPending === 'true',
      onClick: () =>
        onFilterChange({ uiPortalPending: filters.uiPortalPending === 'true' ? '' : 'true' }),
    },
    {
      label: 'RFID not assigned',
      value: usingFullList ? missingRfid : Math.max(0, total - (summary?.rfidAssigned ?? 0)),
      action: 'Review',
      active: filters.uiNoRfid === 'true',
      onClick: () => onFilterChange({ uiNoRfid: filters.uiNoRfid === 'true' ? '' : 'true' }),
    },
    {
      label: 'Timetable not assigned',
      value: usingFullList
        ? teachingWithoutTimetable
        : Math.max(0, teaching - (summary?.timetableAssigned ?? 0)),
      action: 'Assign',
      active: filters.uiNoSubjects === 'true',
      onClick: () =>
        onFilterChange({ uiNoSubjects: filters.uiNoSubjects === 'true' ? '' : 'true' }),
    },
    {
      label: 'Staff without department',
      value: usingFullList ? missingDepartment : 0,
      action: 'Review',
      active: filters.uiNoDepartment === 'true',
      onClick: () =>
        onFilterChange({ uiNoDepartment: filters.uiNoDepartment === 'true' ? '' : 'true' }),
      hidden: !usingFullList && missingDepartment === 0,
    },
    {
      label: 'Staff on leave',
      value: summary?.onLeave ?? 0,
      action: 'View',
      active: filters.status === 'ON_LEAVE',
      onClick: () =>
        onFilterChange({
          status: filters.status === 'ON_LEAVE' ? '' : 'ON_LEAVE',
          uiOnLeave: filters.status === 'ON_LEAVE' ? '' : 'true',
        }),
    },
  ].filter((item) => !item.hidden);

  return (
    <div className="grid gap-3 xl:grid-cols-4">
      <section className="rounded-xl border border-border/70 bg-background p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Staff by Type</h2>
        <div className="mt-4 flex items-center gap-4">
          <Donut
            center={total.toLocaleString('en-IN')}
            caption="Total Staff"
            parts={[
              { value: teaching, color: '#3b82f6' },
              { value: nonTeaching, color: '#f59e0b' },
              { value: guest, color: '#94a3b8' },
              { value: other, color: '#c4b5fd' },
            ]}
          />
          <Legend
            items={[
              {
                label: 'Teaching',
                value: teaching,
                color: 'bg-blue-500',
                hint: share(teaching, total),
              },
              {
                label: 'Non-Teaching',
                value: nonTeaching,
                color: 'bg-amber-500',
                hint: share(nonTeaching, total),
              },
              {
                label: 'Guest / Visiting',
                value: guest,
                color: 'bg-slate-400',
                hint: share(guest, total),
              },
              ...(other > 0
                ? [
                    {
                      label: 'Other',
                      value: other,
                      color: 'bg-violet-300',
                      hint: share(other, total),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-background p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Staff by Department</h2>
        {loading ? (
          <p className="mt-6 text-xs text-muted-foreground">Loading departments…</p>
        ) : visibleDepartments.length === 0 ? (
          <p className="mt-6 text-xs text-muted-foreground">No department assignments yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {visibleDepartments.map(([name, count]) => (
              <li
                key={name}
                className="grid grid-cols-[7rem_1fr_1.5rem] items-center gap-2 text-xs"
              >
                <span className="truncate">{name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-sky-500"
                    style={{ width: `${Math.max(6, (count / maxDepartment) * 100)}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        )}
        {departments.length > 5 ? (
          <button
            type="button"
            className="mt-3 text-xs font-medium text-primary hover:underline"
            onClick={() => setShowAllDepartments((open) => !open)}
          >
            {showAllDepartments ? 'Show top departments' : 'View all departments'}
          </button>
        ) : null}
      </section>

      <section className="rounded-xl border border-border/70 bg-background p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Portal Account Status</h2>
        <div className="mt-4 flex items-center gap-4">
          <Donut
            center={total.toLocaleString('en-IN')}
            caption="Total"
            parts={[
              { value: portalActive, color: '#22c55e' },
              { value: portalPending, color: '#f97316' },
              { value: portalNone, color: '#e2e8f0' },
            ]}
          />
          <Legend
            items={[
              {
                label: 'Active',
                value: portalActive,
                color: 'bg-emerald-500',
                hint: share(portalActive, total),
              },
              {
                label: 'Pending',
                value: portalPending,
                color: 'bg-orange-500',
                hint: share(portalPending, total),
              },
              ...(portalNone > 0
                ? [
                    {
                      label: 'No account',
                      value: portalNone,
                      color: 'bg-slate-200',
                      hint: share(portalNone, total),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </section>

      <section className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-rose-700">
            <AlertTriangle className="h-4 w-4" />
            Attention Required
          </h2>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() =>
              onFilterChange({
                uiPortalPending: '',
                uiNoRfid: '',
                uiNoSubjects: '',
                uiNoDepartment: '',
                uiOnLeave: '',
                status: '',
              })
            }
          >
            View All
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {attention.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-2 text-xs">
              <span className={cn(item.active && 'font-semibold text-sky-800')}>{item.label}</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold tabular-nums text-rose-700">{item.value}</span>
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={item.onClick}
                >
                  {item.action}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
