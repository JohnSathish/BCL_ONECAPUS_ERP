'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import {
  bulkUpdateStaffPfConfig,
  fetchPayAssignments,
  fetchPfEnrolledReport,
  fetchPfExemptReport,
  fetchPfMonthlyReport,
  fetchPfRegister,
  fetchPfByDepartment,
  fetchPfByPayStructure,
} from '@/services/payroll';
import { apiErrorMessage } from '@/utils/api-error';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

type ReportTab = 'enrolled' | 'exempt' | 'monthly' | 'register' | 'by-dept' | 'by-structure';

export function HrPfManagementPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payScaleType, setPayScaleType] = useState('');
  const [reportTab, setReportTab] = useState<ReportTab>('enrolled');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState('');
  const qc = useQueryClient();

  const assignmentsQ = useQuery({
    queryKey: ['payroll', 'assignments', 'pf-bulk'],
    queryFn: () =>
      fetchPayAssignments({ status: 'ACTIVE', payScaleType: payScaleType || undefined }),
  });

  const enrolledQ = useQuery({
    queryKey: ['pf-report', 'enrolled', payScaleType],
    queryFn: () => fetchPfEnrolledReport({ payScaleType: payScaleType || undefined }),
    enabled: reportTab === 'enrolled',
  });

  const exemptQ = useQuery({
    queryKey: ['pf-report', 'exempt', payScaleType],
    queryFn: () => fetchPfExemptReport({ payScaleType: payScaleType || undefined }),
    enabled: reportTab === 'exempt',
  });

  const monthlyQ = useQuery({
    queryKey: ['pf-report', 'monthly', month, year],
    queryFn: () => fetchPfMonthlyReport(month, year),
    enabled: reportTab === 'monthly' || reportTab === 'register',
  });

  const registerQ = useQuery({
    queryKey: ['pf-report', 'register', month, year],
    queryFn: () => fetchPfRegister(month, year),
    enabled: reportTab === 'register',
  });

  const byDeptQ = useQuery({
    queryKey: ['pf-report', 'by-dept', month, year],
    queryFn: () => fetchPfByDepartment(month, year),
    enabled: reportTab === 'by-dept',
  });

  const byStructureQ = useQuery({
    queryKey: ['pf-report', 'by-structure', month, year],
    queryFn: () => fetchPfByPayStructure(month, year),
    enabled: reportTab === 'by-structure',
  });

  const bulkMut = useMutation({
    mutationFn: (body: Parameters<typeof bulkUpdateStaffPfConfig>[0]) =>
      bulkUpdateStaffPfConfig(body),
    onSuccess: (res) => {
      setBulkMessage(`Updated ${res.updated} of ${res.total} staff`);
      setSelectedIds([]);
      void qc.invalidateQueries({ queryKey: ['pf-report'] });
      void qc.invalidateQueries({ queryKey: ['staff-pf-config'] });
    },
    onError: (e) => setBulkMessage(apiErrorMessage(e, 'Bulk update failed')),
  });

  const staffRows = useMemo(() => {
    return (assignmentsQ.data ?? []).map((a) => ({
      id: a.staffProfileId,
      name: a.staffProfile?.fullName ?? '—',
      code: a.staffProfile?.employeeCode ?? '—',
      department: a.staffProfile?.department?.name ?? '—',
      payScaleType: a.payScaleType,
    }));
  }, [assignmentsQ.data]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const reportRows = useMemo(() => {
    switch (reportTab) {
      case 'enrolled':
        return enrolledQ.data?.rows ?? [];
      case 'exempt':
        return exemptQ.data?.rows ?? [];
      case 'monthly':
        return monthlyQ.data?.rows ?? [];
      case 'by-dept':
        return byDeptQ.data ?? [];
      case 'by-structure':
        return byStructureQ.data ?? [];
      case 'register':
        return registerQ.data?.contributions ?? [];
      default:
        return [];
    }
  }, [
    reportTab,
    enrolledQ.data,
    exemptQ.data,
    monthlyQ.data,
    byDeptQ.data,
    byStructureQ.data,
    registerQ.data,
  ]);

  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <h3 className="mb-2 font-semibold">Bulk PF Operations</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Select staff from active pay assignments, then enable, disable, or assign PF structure in
          bulk.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            className="rounded border px-2 py-1 text-sm"
            value={payScaleType}
            onChange={(e) => setPayScaleType(e.target.value)}
          >
            <option value="">All pay scales</option>
            <option value="COLLEGE_TEACHING">COLLEGE_TEACHING</option>
            <option value="COLLEGE_NON_TEACHING">COLLEGE_NON_TEACHING</option>
            <option value="UGC">UGC</option>
            <option value="STATE">STATE</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedIds.length || bulkMut.isPending}
            onClick={() =>
              bulkMut.mutate({
                staffProfileIds: selectedIds,
                pfEnabled: true,
                pfScheme: 'PF_12_PERCENT',
                employeePfApplicable: true,
                employerPfApplicable: true,
                effectiveFrom: new Date().toISOString().slice(0, 10),
              })
            }
          >
            Enable PF
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedIds.length || bulkMut.isPending}
            onClick={() =>
              bulkMut.mutate({
                staffProfileIds: selectedIds,
                pfEnabled: false,
                pfScheme: 'NOT_APPLICABLE',
                effectiveFrom: new Date().toISOString().slice(0, 10),
              })
            }
          >
            Disable PF
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedIds.length || bulkMut.isPending}
            onClick={() =>
              bulkMut.mutate({
                staffProfileIds: selectedIds,
                pfScheme: 'PF_FIXED_AMOUNT',
                employerPfAmount: 780,
                employeePfAmount: 780,
                effectiveFrom: new Date().toISOString().slice(0, 10),
              })
            }
          >
            Assign Fixed ₹780
          </Button>
        </div>
        {bulkMessage ? <p className="mb-2 text-xs">{bulkMessage}</p> : null}
        <div className="max-h-48 overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="p-2 text-left">Select</th>
                <th className="p-2 text-left">Code</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Department</th>
              </tr>
            </thead>
            <tbody>
              {staffRows.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={() => toggleSelect(s.id)}
                    />
                  </td>
                  <td className="p-2 font-mono">{s.code}</td>
                  <td className="p-2">{s.name}</td>
                  <td className="p-2">{s.department}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">PF Reports</h3>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="w-20 rounded border px-2 py-1 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <div className="mb-3 flex flex-wrap gap-1">
          {(
            [
              ['enrolled', 'Enrolled Staff'],
              ['exempt', 'Exempt Staff'],
              ['monthly', 'Monthly Contribution'],
              ['register', 'PF Register'],
              ['by-dept', 'By Department'],
              ['by-structure', 'By Pay Structure'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={reportTab === key ? 'default' : 'outline'}
              onClick={() => setReportTab(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {reportTab === 'register' && registerQ.data ? (
          <div className="mb-3 grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded border p-2">
              Enrolled: <strong>{registerQ.data.summary.enrolledStaff}</strong>
            </div>
            <div className="rounded border p-2">
              Exempt: <strong>{registerQ.data.summary.exemptStaff}</strong>
            </div>
            <div className="rounded border p-2">
              Total PF Deposit: <strong>{formatInr(registerQ.data.summary.totalPfDeposit)}</strong>
            </div>
          </div>
        ) : null}

        {reportTab === 'monthly' && monthlyQ.data ? (
          <p className="mb-2 text-xs text-muted-foreground">
            {monthlyQ.data.count} staff · Employee {formatInr(monthlyQ.data.totalEmployee)} ·
            Employer {formatInr(monthlyQ.data.totalEmployer)} · Total{' '}
            {formatInr(monthlyQ.data.totalDeposit)}
          </p>
        ) : null}

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                {reportTab === 'by-dept' ? (
                  <>
                    <th className="py-2">Department</th>
                    <th>Staff</th>
                    <th>Employee</th>
                    <th>Employer</th>
                  </>
                ) : reportTab === 'by-structure' ? (
                  <>
                    <th className="py-2">Pay Structure</th>
                    <th>Staff</th>
                    <th>Employee</th>
                    <th>Employer</th>
                  </>
                ) : reportTab === 'monthly' || reportTab === 'register' ? (
                  <>
                    <th className="py-2">Employee</th>
                    <th>Department</th>
                    <th>Employee PF</th>
                    <th>Employer PF</th>
                    <th>Total</th>
                  </>
                ) : (
                  <>
                    <th className="py-2">Code</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Scheme</th>
                    <th>Status</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {(reportRows as Array<Record<string, unknown>>).map((row, i) => (
                <tr key={i} className="border-b">
                  {reportTab === 'by-dept' ? (
                    <>
                      <td className="py-2">{String(row.department)}</td>
                      <td>{String(row.count)}</td>
                      <td>{formatInr(Number(row.employee))}</td>
                      <td>{formatInr(Number(row.employer))}</td>
                    </>
                  ) : reportTab === 'by-structure' ? (
                    <>
                      <td className="py-2">{String(row.structure)}</td>
                      <td>{String(row.count)}</td>
                      <td>{formatInr(Number(row.employee))}</td>
                      <td>{formatInr(Number(row.employer))}</td>
                    </>
                  ) : reportTab === 'monthly' || reportTab === 'register' ? (
                    <>
                      <td className="py-2">{String(row.fullName)}</td>
                      <td>{String(row.department)}</td>
                      <td>{formatInr(Number(row.employeeContribution))}</td>
                      <td>{formatInr(Number(row.employerContribution))}</td>
                      <td>{formatInr(Number(row.total))}</td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 font-mono">{String(row.employeeCode)}</td>
                      <td>{String(row.fullName)}</td>
                      <td>{String(row.department)}</td>
                      <td>{String(row.pfScheme)}</td>
                      <td>{reportTab === 'enrolled' ? 'Enrolled' : 'Exempt'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
