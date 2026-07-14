'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Users } from 'lucide-react';

import { ShiftFacultyAssignPanel } from '@/components/academics/shift-faculty-assign-panel';
import { ShiftAssignmentBadges } from '@/components/academics/shift-assignment-badges';
import { ShiftFacultyUnassignButton } from '@/components/academics/shift-faculty-unassign-button';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody } from '@/components/erp/compact-card';
import { useAuthQueryEnabled, useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useWorkspaceBoundShiftState } from '@/hooks/use-workspace-bound-shift-state';
import { fetchFacultyShiftAssignments } from '@/services/faculty-shifts';
import { fetchTimetableContext } from '@/services/timetable';
import { cn } from '@/utils/cn';

export default function ShiftFacultyPage() {
  useRequireAuth();
  const authReady = useAuthQueryEnabled();
  const { can } = usePermissions();
  const canManage = can('shift:manage');
  const { shiftId, setShiftId, effectiveShiftId, hideShiftFilter, workspaceShiftLabel } =
    useWorkspaceBoundShiftState();
  const [search, setSearch] = useState('');

  const contextQ = useQuery({
    queryKey: ['timetable', 'context'],
    queryFn: fetchTimetableContext,
    enabled: authReady,
  });

  const selectedShiftId = effectiveShiftId ?? shiftId;

  const facultyQ = useQuery({
    queryKey: ['faculty-shifts', selectedShiftId],
    queryFn: () => fetchFacultyShiftAssignments(selectedShiftId!),
    enabled: authReady && Boolean(selectedShiftId),
  });

  const rows = facultyQ.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.fullName, row.shortCode, row.employeeCode, row.email, row.department?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const teachingCount = rows.filter((r) => r.staffType === 'TEACHING').length;

  return (
    <DashboardShell role="admin" title="Shift Faculty">
      <div className="space-y-5">
        <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Shift delivery
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Faculty assigned to shift</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Teaching and support staff mapped to this shift for timetable, attendance, and section
            delivery. Full HR records remain in the institution Staff module.
          </p>
        </section>

        <div className="flex flex-wrap items-end gap-3">
          {!hideShiftFilter ? (
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Shift
              <select
                className="block h-10 min-w-[200px] rounded-md border bg-card px-3 text-sm"
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
              >
                <option value="">Select shift</option>
                {(contextQ.data?.shifts ?? []).map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Workspace shift: </span>
              <span className="font-medium">{workspaceShiftLabel ?? 'Morning'}</span>
            </div>
          )}
          <label className="min-w-[220px] flex-1 space-y-1 text-xs font-medium text-muted-foreground">
            Search
            <input
              className="block h-10 w-full rounded-md border bg-card px-3 text-sm"
              placeholder="Name, code, department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {canManage && selectedShiftId ? (
          <ShiftFacultyAssignPanel shiftId={selectedShiftId} />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Assigned staff" value={rows.length} icon={Users} />
          <MetricCard label="Teaching faculty" value={teachingCount} icon={GraduationCap} />
          <MetricCard
            label="Departments"
            value={new Set(rows.map((r) => r.department?.id).filter(Boolean)).size}
            icon={Users}
          />
        </div>

        {!selectedShiftId ? (
          <p className="text-sm text-muted-foreground">Select a shift to load assigned faculty.</p>
        ) : facultyQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading faculty…</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Assigned shifts</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Hours/wk</th>
                  {canManage ? <th className="px-4 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.fullName}</div>
                      <div className="text-xs text-muted-foreground">{row.email ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <ShiftAssignmentBadges
                        shifts={row.assignedShifts}
                        currentShiftId={selectedShiftId}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>{row.shortCode ?? row.employeeCode}</div>
                      <div className="text-xs text-muted-foreground">{row.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3">{row.department?.name ?? '—'}</td>
                    <td className="px-4 py-3">{row.designation?.label ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs',
                          row.staffType === 'TEACHING'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {row.staffType}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.hoursPerWeek ?? '—'}</td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <ShiftFacultyUnassignButton
                          shiftId={selectedShiftId}
                          staffProfileId={row.staffProfileId}
                          fullName={row.fullName}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No faculty assigned to this shift yet.
              </p>
            ) : null}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {canManage ? (
            <>
              Use the assign panel above to add staff to this shift, or remove them from the roster.
              Full HR records remain in the institution Staff module.{' '}
            </>
          ) : (
            <>
              Assignments are managed here when you have{' '}
              <code className="rounded bg-muted px-1">shift:manage</code>. Full HR records remain in
              the institution Staff module.{' '}
            </>
          )}
          <Link
            href="/admin/academics/teaching-allocation"
            className="text-primary hover:underline"
          >
            Open Teaching Allocation →
          </Link>
        </p>
      </div>
    </DashboardShell>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <CompactCard>
      <CompactCardBody className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value.toLocaleString('en-IN')}</p>
        </div>
      </CompactCardBody>
    </CompactCard>
  );
}
