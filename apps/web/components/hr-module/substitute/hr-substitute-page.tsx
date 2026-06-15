'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserRound, Users } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { AssignReplacementDialog } from '@/components/hr-module/substitute/assign-replacement-dialog';
import {
  cancelReplacementAssignment,
  completeReplacementAssignment,
  fetchReplacementAssignments,
  fetchSubstituteDashboard,
  fetchSubstituteStaff,
  REPLACEMENT_REASON_OPTIONS,
  SALARY_ARRANGEMENT_OPTIONS,
} from '@/services/hr-substitute';
import { formatDisplayDate } from '@/utils/format-date';
import { apiErrorMessage } from '@/utils/api-error';

type Tab = 'assignments' | 'substitutes' | 'reports';

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function HrSubstituteStaffPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('assignments');
  const [assignOpen, setAssignOpen] = useState(false);
  const [search, setSearch] = useState('');

  const dashboard = useQuery({
    queryKey: ['hr', 'substitute', 'dashboard'],
    queryFn: fetchSubstituteDashboard,
  });
  const assignments = useQuery({
    queryKey: ['hr', 'substitute', 'assignments', search, tab],
    queryFn: () =>
      fetchReplacementAssignments({
        search: search || undefined,
        status: tab === 'reports' ? undefined : undefined,
        limit: 50,
      }),
    enabled: tab === 'assignments' || tab === 'reports',
  });
  const substitutes = useQuery({
    queryKey: ['hr', 'substitute', 'staff', search],
    queryFn: () => fetchSubstituteStaff({ search: search || undefined, limit: 50 }),
    enabled: tab === 'substitutes',
  });

  const endMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'complete' | 'cancel' }) =>
      action === 'complete' ? completeReplacementAssignment(id) : cancelReplacementAssignment(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hr', 'substitute'] });
    },
  });

  const rows = useMemo(() => {
    if (tab === 'substitutes') return substitutes.data?.data ?? [];
    const data = assignments.data?.data ?? [];
    if (tab === 'reports') return data;
    return data.filter((row) => row.status === 'ACTIVE' || !search);
  }, [tab, assignments.data, substitutes.data, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Substitute / Replacement Staff</h2>
          <p className="text-sm text-muted-foreground">
            Manage study leave, sabbatical, and long-term faculty replacements without duplicate
            staff records.
          </p>
        </div>
        <Button type="button" onClick={() => setAssignOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Assign Replacement Faculty
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Active Assignments" value={dashboard.data?.activeAssignments ?? 0} />
        <Kpi label="Study Leave Faculty" value={dashboard.data?.studyLeaveFaculty ?? 0} />
        <Kpi label="Maternity Leave Faculty" value={dashboard.data?.maternityLeaveFaculty ?? 0} />
        <Kpi label="Expiring This Month" value={dashboard.data?.expiringThisMonth ?? 0} />
      </div>

      <GlassCard className="p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(['assignments', 'substitutes', 'reports'] as Tab[]).map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={tab === key ? 'default' : 'outline'}
              onClick={() => setTab(key)}
            >
              {key === 'assignments'
                ? 'Active Assignments'
                : key === 'substitutes'
                  ? 'Substitute Directory'
                  : 'History & Reports'}
            </Button>
          ))}
          <input
            className="ml-auto h-8 min-w-[200px] rounded-md border border-border bg-background px-2 text-sm"
            placeholder="Search faculty or substitute..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {tab === 'substitutes' ? (
                  <>
                    <th className="px-2 py-2">Code</th>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Department</th>
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2">Current Assignment</th>
                    <th className="px-2 py-2">Status</th>
                  </>
                ) : (
                  <>
                    <th className="px-2 py-2">Original Faculty</th>
                    <th className="px-2 py-2">Replacement</th>
                    <th className="px-2 py-2">Reason</th>
                    <th className="px-2 py-2">Period</th>
                    <th className="px-2 py-2">Salary Arrangement</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2" />
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {tab === 'substitutes'
                ? (rows as Awaited<ReturnType<typeof fetchSubstituteStaff>>['data']).map((row) => (
                    <tr key={row.id} className="border-b hover:bg-muted/20">
                      <td className="px-2 py-2 font-mono text-xs">{row.substituteCode}</td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/admin/hr/substitute-staff/${row.id}`}
                          className="font-medium hover:underline"
                        >
                          {row.fullName}
                        </Link>
                      </td>
                      <td className="px-2 py-2">{row.department ?? '—'}</td>
                      <td className="px-2 py-2">{row.category.replace(/_/g, ' ')}</td>
                      <td className="px-2 py-2 text-xs">
                        {row.currentAssignment
                          ? `${row.currentAssignment.originalStaffName} (${formatDisplayDate(row.currentAssignment.endDate)})`
                          : '—'}
                      </td>
                      <td className="px-2 py-2">{row.status}</td>
                    </tr>
                  ))
                : (rows as Awaited<ReturnType<typeof fetchReplacementAssignments>>['data']).map(
                    (row) => (
                      <tr key={row.id} className="border-b hover:bg-muted/20">
                        <td className="px-2 py-2">
                          <div className="font-medium">{row.originalStaff.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.originalStaff.employeeCode}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Link
                            href={`/admin/hr/substitute-staff/${row.substitute.id}`}
                            className="hover:underline"
                          >
                            {row.substitute.fullName}
                          </Link>
                        </td>
                        <td className="px-2 py-2">{row.reasonLabel}</td>
                        <td className="px-2 py-2 text-xs">
                          {formatDisplayDate(row.startDate)} – {formatDisplayDate(row.endDate)}
                        </td>
                        <td className="px-2 py-2 text-xs">
                          {SALARY_ARRANGEMENT_OPTIONS.find((o) => o.value === row.salaryArrangement)
                            ?.label ?? row.salaryArrangement}
                          {row.monthlyAgreedAmount
                            ? ` · ₹${row.monthlyAgreedAmount.toLocaleString('en-IN')}`
                            : ''}
                        </td>
                        <td className="px-2 py-2">{row.status}</td>
                        <td className="px-2 py-2">
                          {row.status === 'ACTIVE' ? (
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={endMut.isPending}
                                onClick={() => endMut.mutate({ id: row.id, action: 'complete' })}
                              >
                                End
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                disabled={endMut.isPending}
                                onClick={() => endMut.mutate({ id: row.id, action: 'cancel' })}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ),
                  )}
            </tbody>
          </table>
          {!rows.length ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">No records found.</p>
          ) : null}
        </div>
        {endMut.isError ? (
          <p className="mt-2 text-sm text-destructive">
            {apiErrorMessage(endMut.error, 'Action failed')}
          </p>
        ) : null}
      </GlassCard>

      <AssignReplacementDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onSuccess={() => {
          void qc.invalidateQueries({ queryKey: ['hr', 'substitute'] });
        }}
      />
    </div>
  );
}
