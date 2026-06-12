'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Calculator, FileSpreadsheet, Layers3, RefreshCw } from 'lucide-react';
import { PayAssignmentsPage } from '@/components/hr-module/pay-assignments-page';
import { FormulaBuilder, type FormulaNode } from '@/components/hr-module/formula-builder';
import { HrPfManagementPage } from '@/components/hr-module/hr-pf-management-page';
import { PayslipsPage } from '@/components/hr-module/payslips-page';
import { PayrollRunAdjustmentsPanel } from '@/components/hr-module/payroll-run-adjustments-panel';
import { PayrollRunStatement } from '@/components/hr-module/payroll-run-statement';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import {
  applyIncrementBatch,
  applyArrearToRun,
  approvePayrollRun,
  calculatePayrollRun,
  createIncrementBatch,
  createSalaryRevision,
  createPayrollRun,
  emailPayrollRunPayslips,
  exportBankTransferFile,
  exportBulkSalarySheet,
  exportSalaryRegister,
  fetchArrearBatches,
  fetchDepartmentWiseSalary,
  fetchIncrementBatches,
  fetchPaySalaryComponents,
  fetchPayStructure,
  fetchPayStructures,
  fetchPayAssignments,
  fetchPayrollAuditLogs,
  fetchPayrollRuns,
  fetchPayrollSettings,
  fetchRunAdjustments,
  fetchRunExclusions,
  fetchSalaryRevisions,
  getPayrollRun,
  markPayrollRunPaid,
  previewIncrementBatch,
  previewPayStructure,
  previewProfessionalTax,
  previewTds,
  publishPayrollRun,
  reopenPayrollRun,
  updatePayStructure,
  updatePayrollSettings,
  verifyPayrollRun,
} from '@/services/payroll';
import { PAY_SCALE_TYPES } from '@/types/payroll';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

export type HrPage =
  | 'salary-components'
  | 'pay-structures'
  | 'assignments'
  | 'revisions'
  | 'increments'
  | 'payroll-runs'
  | 'pf-cpf'
  | 'payslips'
  | 'reports'
  | 'settings';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function HrWorkspace({ page = 'salary-components' }: { page?: HrPage }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const now = new Date();

  const [runForm, setRunForm] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    payScaleType: 'COLLEGE_NON_TEACHING',
  });
  const [selectedRunId, setSelectedRunId] = useState('');
  const [incrementForm, setIncrementForm] = useState({
    name: 'Annual Increment 2026',
    incrementType: 'FLAT',
    incrementValue: 500,
    effectiveFrom: now.toISOString().slice(0, 10),
    payScaleType: 'COLLEGE_TEACHING',
  });
  const [previewBasic, setPreviewBasic] = useState(50000);
  const [selectedStructureId, setSelectedStructureId] = useState('');
  const [previewBatchId, setPreviewBatchId] = useState('');
  const [structureEditName, setStructureEditName] = useState('');
  const [structureFormulas, setStructureFormulas] = useState<Record<string, FormulaNode>>({});
  const [selectedArrearId, setSelectedArrearId] = useState('');
  const [ptPreviewGross, setPtPreviewGross] = useState(25000);
  const [ptPreviewMonth, setPtPreviewMonth] = useState(now.getMonth() + 1);
  const [tdsPreviewGross, setTdsPreviewGross] = useState(50000);
  const [revisionForm, setRevisionForm] = useState({
    staffPayAssignmentId: '',
    revisionType: 'INCREMENT',
    newBasicPay: 0,
    effectiveFrom: now.toISOString().slice(0, 10),
    notes: '',
  });

  const componentsQ = useQuery({
    queryKey: ['payroll', 'components'],
    queryFn: () => fetchPaySalaryComponents(),
    enabled: page === 'salary-components' || page === 'pay-structures',
  });
  const structuresQ = useQuery({
    queryKey: ['payroll', 'structures'],
    queryFn: () => fetchPayStructures(),
    enabled: ['pay-structures', 'payroll-runs'].includes(page),
  });
  const revisionsQ = useQuery({
    queryKey: ['payroll', 'revisions'],
    queryFn: () => fetchSalaryRevisions(),
    enabled: page === 'revisions',
  });
  const assignmentsForRevisionQ = useQuery({
    queryKey: ['payroll', 'assignments', 'revision-form'],
    queryFn: () => fetchPayAssignments({ status: 'ACTIVE' }),
    enabled: page === 'revisions',
  });
  const incrementsQ = useQuery({
    queryKey: ['payroll', 'increments'],
    queryFn: fetchIncrementBatches,
    enabled: page === 'increments',
  });
  const runsQ = useQuery({
    queryKey: ['payroll', 'runs'],
    queryFn: () => fetchPayrollRuns(),
    enabled: ['payroll-runs', 'reports'].includes(page),
  });
  const runDetailQ = useQuery({
    queryKey: ['payroll', 'run', selectedRunId],
    queryFn: () => getPayrollRun(selectedRunId),
    enabled: !!selectedRunId && page === 'payroll-runs',
  });
  const settingsQ = useQuery({
    queryKey: ['payroll', 'settings'],
    queryFn: fetchPayrollSettings,
    enabled: page === 'settings',
  });
  const arrearsQ = useQuery({
    queryKey: ['payroll', 'arrears'],
    queryFn: fetchArrearBatches,
    enabled: page === 'reports',
  });
  const deptQ = useQuery({
    queryKey: ['payroll', 'dept', now.getMonth(), now.getFullYear()],
    queryFn: () => fetchDepartmentWiseSalary(now.getMonth() + 1, now.getFullYear()),
    enabled: page === 'reports',
  });
  const incrementPreviewQ = useQuery({
    queryKey: ['payroll', 'increment-preview', previewBatchId],
    queryFn: () => previewIncrementBatch(previewBatchId),
    enabled: !!previewBatchId && page === 'increments',
  });
  const structureDetailQ = useQuery({
    queryKey: ['payroll', 'structure', selectedStructureId],
    queryFn: () => fetchPayStructure(selectedStructureId),
    enabled: !!selectedStructureId && page === 'pay-structures',
  });
  const runExclusionsQ = useQuery({
    queryKey: ['payroll', 'run-exclusions', selectedRunId],
    queryFn: () => fetchRunExclusions(selectedRunId),
    enabled: !!selectedRunId && page === 'payroll-runs',
  });
  const runAdjustmentsQ = useQuery({
    queryKey: ['payroll', 'run-adjustments', selectedRunId],
    queryFn: () => fetchRunAdjustments(selectedRunId),
    enabled: !!selectedRunId && page === 'payroll-runs',
  });
  const auditLogsQ = useQuery({
    queryKey: ['payroll', 'audit-logs'],
    queryFn: () => fetchPayrollAuditLogs(),
    enabled: page === 'reports',
  });
  const ptPreviewQ = useQuery({
    queryKey: ['payroll', 'pt-preview', ptPreviewGross, ptPreviewMonth],
    queryFn: () => previewProfessionalTax(ptPreviewGross, ptPreviewMonth),
    enabled: page === 'settings',
  });
  const tdsPreviewQ = useQuery({
    queryKey: ['payroll', 'tds-preview', tdsPreviewGross],
    queryFn: () => previewTds(tdsPreviewGross),
    enabled: page === 'settings',
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['payroll'] });

  const createRunMut = useMutation({
    mutationFn: createPayrollRun,
    onSuccess: (r) => {
      setSelectedRunId(r.id);
      setMessage('Payroll run created');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Operation failed')),
  });
  const calcMut = useMutation({
    mutationFn: calculatePayrollRun,
    onSuccess: () => {
      setMessage('Payroll calculated');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Operation failed')),
  });
  const verifyMut = useMutation({
    mutationFn: verifyPayrollRun,
    onSuccess: () => {
      setMessage('Verified');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Operation failed')),
  });
  const approveMut = useMutation({
    mutationFn: approvePayrollRun,
    onSuccess: () => {
      setMessage('Approved');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Operation failed')),
  });
  const publishMut = useMutation({
    mutationFn: publishPayrollRun,
    onSuccess: () => {
      setMessage('Published');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Operation failed')),
  });
  const reopenMut = useMutation({
    mutationFn: reopenPayrollRun,
    onSuccess: () => {
      setMessage('Run reopened — recalculate with corrected formulas.');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Operation failed')),
  });
  const incrementMut = useMutation({
    mutationFn: () =>
      createIncrementBatch({
        ...incrementForm,
        filterJson: { payScaleType: incrementForm.payScaleType },
      }),
    onSuccess: () => {
      setMessage('Increment batch created');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Operation failed')),
  });
  const applyIncrementMut = useMutation({
    mutationFn: applyIncrementBatch,
    onSuccess: () => {
      setMessage('Increment applied');
      setPreviewBatchId('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Operation failed')),
  });
  const markPaidMut = useMutation({
    mutationFn: markPayrollRunPaid,
    onSuccess: () => {
      setMessage('Payroll run marked as paid');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Operation failed')),
  });
  const emailPayslipsMut = useMutation({
    mutationFn: emailPayrollRunPayslips,
    onSuccess: (r) => {
      setMessage(`Payslip emails: ${r.sent} sent, ${r.skipped} skipped, ${r.failed} failed`);
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Operation failed')),
  });
  const applyArrearMut = useMutation({
    mutationFn: ({ arrearId, runId }: { arrearId: string; runId: string }) =>
      applyArrearToRun(arrearId, runId),
    onSuccess: () => {
      setMessage('Arrears applied to payroll run');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Operation failed')),
  });
  const updateStructureMut = useMutation({
    mutationFn: () => {
      const components = (structureDetailQ.data?.components ?? []).map((c, idx) => ({
        paySalaryComponentId: c.paySalaryComponent.id,
        formulaJson: structureFormulas[c.id] ?? c.formulaJson,
        sortOrder: (idx + 1) * 10,
      }));
      return updatePayStructure(selectedStructureId, { name: structureEditName, components });
    },
    onSuccess: () => {
      setMessage('Pay structure saved');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Operation failed')),
  });
  const createRevisionMut = useMutation({
    mutationFn: () => createSalaryRevision(revisionForm),
    onSuccess: () => {
      setMessage('Salary revision created');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Operation failed')),
  });
  const settingsMut = useMutation({
    mutationFn: updatePayrollSettings,
    onSuccess: () => {
      setMessage('Settings saved');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Operation failed')),
  });

  const previewQ = useQuery({
    queryKey: ['payroll', 'preview', selectedStructureId, previewBasic],
    queryFn: () => previewPayStructure(selectedStructureId, previewBasic),
    enabled: !!selectedStructureId && page === 'pay-structures',
  });

  useEffect(() => {
    if (!structureDetailQ.data) return;
    setStructureEditName(structureDetailQ.data.name);
    const formulas: Record<string, FormulaNode> = {};
    for (const c of structureDetailQ.data.components ?? []) {
      formulas[c.id] = c.formulaJson as FormulaNode;
    }
    setStructureFormulas(formulas);
  }, [structureDetailQ.data]);

  return (
    <div className="space-y-4">
      {(message || error) && (
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-sm',
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700',
          )}
        >
          {error || message}
        </div>
      )}

      {page === 'salary-components' && (
        <GlassCard className="p-4">
          <h3 className="mb-3 font-semibold">Salary Component Master</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Statutory</th>
              </tr>
            </thead>
            <tbody>
              {(componentsQ.data ?? []).map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-2 font-mono">{c.code}</td>
                  <td>{c.name}</td>
                  <td>{c.componentType}</td>
                  <td>{c.isStatutory ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      {page === 'pay-structures' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <GlassCard className="p-4">
            <h3 className="mb-3 font-semibold">Pay Structure Templates</h3>
            <ul className="space-y-2">
              {(structuresQ.data ?? []).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full rounded border px-3 py-2 text-left text-sm hover:bg-muted',
                      selectedStructureId === s.id && 'border-primary bg-primary/5',
                    )}
                    onClick={() => setSelectedStructureId(s.id)}
                  >
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.structureType} · {s.components?.length ?? 0} components
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </GlassCard>
          <GlassCard className="p-4">
            <h3 className="mb-3 font-semibold">Structure Studio</h3>
            {selectedStructureId && structureDetailQ.data ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  Template name
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    value={structureEditName}
                    onChange={(e) => setStructureEditName(e.target.value)}
                  />
                </label>
                <div className="max-h-64 space-y-2 overflow-auto text-xs">
                  {(structureDetailQ.data.components ?? []).map((c) => (
                    <div key={c.id} className="rounded border p-2">
                      <div className="mb-1 font-medium">
                        {c.paySalaryComponent.name} ({c.paySalaryComponent.code})
                      </div>
                      <FormulaBuilder
                        value={structureFormulas[c.id] ?? (c.formulaJson as FormulaNode)}
                        componentCodes={(structureDetailQ.data.components ?? []).map(
                          (x) => x.paySalaryComponent.code,
                        )}
                        onChange={(node) =>
                          setStructureFormulas({ ...structureFormulas, [c.id]: node })
                        }
                      />
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={() => updateStructureMut.mutate()}
                  disabled={updateStructureMut.isPending}
                >
                  Save Structure
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a template to edit component formulas.
              </p>
            )}
          </GlassCard>
          <GlassCard className="p-4">
            <h3 className="mb-3 font-semibold">Formula Preview</h3>
            <label className="text-sm">
              Sample Basic Pay
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1"
                value={previewBasic}
                onChange={(e) => setPreviewBasic(Number(e.target.value))}
              />
            </label>
            {previewQ.data && (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-1 text-left">Component</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(previewQ.data as Array<{ code: string; name: string; amount: number }>).map(
                    (l) => (
                      <tr key={l.code} className="border-b">
                        <td className="py-1">{l.name}</td>
                        <td>₹{l.amount.toLocaleString('en-IN')}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            )}
          </GlassCard>
        </div>
      )}

      {page === 'assignments' && <PayAssignmentsPage />}

      {page === 'revisions' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-4 space-y-2">
            <h3 className="font-semibold">Individual Salary Revision</h3>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={revisionForm.staffPayAssignmentId}
              onChange={(e) => {
                const id = e.target.value;
                const assignment = (assignmentsForRevisionQ.data ?? []).find((a) => a.id === id);
                setRevisionForm({
                  ...revisionForm,
                  staffPayAssignmentId: id,
                  newBasicPay: assignment ? Number(assignment.basicPay) : 0,
                });
              }}
            >
              <option value="">Select staff assignment</option>
              {(assignmentsForRevisionQ.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.staffProfile?.fullName} — ₹{Number(a.basicPay).toLocaleString('en-IN')} (
                  {a.payScaleType})
                </option>
              ))}
            </select>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={revisionForm.revisionType}
              onChange={(e) => setRevisionForm({ ...revisionForm, revisionType: e.target.value })}
            >
              <option value="INCREMENT">Increment</option>
              <option value="PROMOTION">Promotion</option>
              <option value="CORRECTION">Correction</option>
              <option value="DEMOTION">Demotion</option>
            </select>
            <input
              type="number"
              className="w-full rounded border px-2 py-1 text-sm"
              placeholder="New basic pay"
              value={revisionForm.newBasicPay || ''}
              onChange={(e) =>
                setRevisionForm({ ...revisionForm, newBasicPay: Number(e.target.value) })
              }
            />
            <input
              type="date"
              className="w-full rounded border px-2 py-1 text-sm"
              value={revisionForm.effectiveFrom}
              onChange={(e) => setRevisionForm({ ...revisionForm, effectiveFrom: e.target.value })}
            />
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              placeholder="Notes"
              value={revisionForm.notes}
              onChange={(e) => setRevisionForm({ ...revisionForm, notes: e.target.value })}
            />
            <Button
              size="sm"
              disabled={!revisionForm.staffPayAssignmentId}
              onClick={() => createRevisionMut.mutate()}
            >
              Create Revision
            </Button>
          </GlassCard>
          <GlassCard className="p-4">
            <h3 className="mb-3 font-semibold">Salary Revision Register</h3>
            <div className="max-h-96 space-y-2 overflow-auto text-sm">
              {(
                (revisionsQ.data as Array<{
                  id: string;
                  revisionType: string;
                  effectiveFrom: string;
                  newBasicPay?: number;
                  staffPayAssignment?: { staffProfile?: { fullName: string }; basicPay?: number };
                }>) ?? []
              ).map((r) => (
                <div key={r.id} className="rounded border px-3 py-2">
                  <div className="font-medium">{r.staffPayAssignment?.staffProfile?.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.revisionType} · effective {r.effectiveFrom.slice(0, 10)}
                    {r.newBasicPay != null &&
                      ` · ₹${Number(r.newBasicPay).toLocaleString('en-IN')}`}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {page === 'increments' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard className="p-4 space-y-2">
              <h3 className="font-semibold">Mass Increment</h3>
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                value={incrementForm.name}
                onChange={(e) => setIncrementForm({ ...incrementForm, name: e.target.value })}
              />
              <select
                className="w-full rounded border px-2 py-1 text-sm"
                value={incrementForm.incrementType}
                onChange={(e) =>
                  setIncrementForm({ ...incrementForm, incrementType: e.target.value })
                }
              >
                <option value="FLAT">Flat ₹</option>
                <option value="PERCENT">Percent %</option>
              </select>
              <input
                type="number"
                className="w-full rounded border px-2 py-1 text-sm"
                value={incrementForm.incrementValue}
                onChange={(e) =>
                  setIncrementForm({ ...incrementForm, incrementValue: Number(e.target.value) })
                }
              />
              <Button size="sm" onClick={() => incrementMut.mutate()}>
                Create Batch
              </Button>
            </GlassCard>
            <GlassCard className="p-4">
              <h3 className="mb-3 font-semibold">Increment Batches</h3>
              {(
                (incrementsQ.data as Array<{
                  id: string;
                  name: string;
                  status: string;
                  appliedCount: number;
                }>) ?? []
              ).map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b py-2 text-sm">
                  <span>
                    {b.name} ({b.status}) — {b.appliedCount} applied
                  </span>
                  {b.status === 'DRAFT' && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setPreviewBatchId(b.id)}>
                        Preview
                      </Button>
                      <Button size="sm" onClick={() => applyIncrementMut.mutate(b.id)}>
                        Apply
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </GlassCard>
          </div>
          {previewBatchId && incrementPreviewQ.data && (
            <GlassCard className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">
                  Increment Preview — {incrementPreviewQ.data.batch.name}
                </h3>
                <Button size="sm" variant="ghost" onClick={() => setPreviewBatchId('')}>
                  Close
                </Button>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">
                {incrementPreviewQ.data.summary.staffCount} staff · Total increase ₹
                {incrementPreviewQ.data.summary.totalIncrease.toLocaleString('en-IN')}
              </p>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-1">Employee</th>
                      <th>Dept</th>
                      <th>Previous</th>
                      <th>New</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incrementPreviewQ.data.rows.map((r) => (
                      <tr key={r.staffProfileId} className="border-b">
                        <td className="py-1">
                          {r.staffName} ({r.employeeCode})
                        </td>
                        <td>{r.department}</td>
                        <td>₹{r.previousBasicPay.toLocaleString('en-IN')}</td>
                        <td>₹{r.newBasicPay.toLocaleString('en-IN')}</td>
                        <td className="text-emerald-700">+₹{r.change.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => applyIncrementMut.mutate(previewBatchId)}
              >
                Confirm & Apply
              </Button>
            </GlassCard>
          )}
        </div>
      )}

      {page === 'payroll-runs' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard className="p-4 space-y-2">
              <h3 className="font-semibold">Create Payroll Run</h3>
              <select
                className="w-full rounded border px-2 py-1 text-sm"
                value={runForm.month}
                onChange={(e) => setRunForm({ ...runForm, month: Number(e.target.value) })}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="w-full rounded border px-2 py-1 text-sm"
                value={runForm.year}
                onChange={(e) => setRunForm({ ...runForm, year: Number(e.target.value) })}
              />
              <select
                className="w-full rounded border px-2 py-1 text-sm"
                value={runForm.payScaleType}
                onChange={(e) => setRunForm({ ...runForm, payScaleType: e.target.value })}
              >
                {PAY_SCALE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={() => createRunMut.mutate(runForm)}>
                <Calculator className="mr-1 h-3 w-3" /> Create Run
              </Button>
            </GlassCard>
            <GlassCard className="p-4">
              <h3 className="mb-3 font-semibold">Payroll Runs</h3>
              {(runsQ.data ?? []).map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    'mb-2 rounded border p-2 text-sm',
                    selectedRunId === r.id && 'border-primary',
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setSelectedRunId(r.id)}
                  >
                    <div className="font-medium">
                      {MONTHS[r.month - 1]} {r.year} — {r.payScaleType}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.status} · {r.employeeCount} staff · ₹
                      {Number(r.totalNet).toLocaleString('en-IN')}
                      {r.paidAt && ` · Paid ${new Date(r.paidAt).toLocaleDateString()}`}
                    </div>
                  </button>
                  {selectedRunId === r.id && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.status === 'DRAFT' && (
                        <Button size="sm" variant="outline" onClick={() => calcMut.mutate(r.id)}>
                          Calculate
                        </Button>
                      )}
                      {r.status === 'DRAFT' && (
                        <Button size="sm" variant="outline" onClick={() => verifyMut.mutate(r.id)}>
                          Verify
                        </Button>
                      )}
                      {r.status === 'VERIFIED' && (
                        <Button size="sm" variant="outline" onClick={() => approveMut.mutate(r.id)}>
                          Approve
                        </Button>
                      )}
                      {r.status === 'APPROVED' && (
                        <Button size="sm" onClick={() => publishMut.mutate(r.id)}>
                          Publish
                        </Button>
                      )}
                      {r.status === 'PUBLISHED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => emailPayslipsMut.mutate(r.id)}
                        >
                          Email Payslips
                        </Button>
                      )}
                      {r.status === 'PUBLISHED' && !r.paidAt && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markPaidMut.mutate(r.id)}
                        >
                          Mark as Paid
                        </Button>
                      )}
                      {r.status === 'PUBLISHED' && (
                        <Button size="sm" variant="outline" onClick={() => reopenMut.mutate(r.id)}>
                          Reopen for Recalculation
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {selectedRunId &&
                runExclusionsQ.data &&
                (runExclusionsQ.data as unknown[]).length > 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    {(runExclusionsQ.data as unknown[]).length} staff excluded from this run
                  </p>
                )}
              {selectedRunId &&
                runAdjustmentsQ.data &&
                (runAdjustmentsQ.data as unknown[]).length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(runAdjustmentsQ.data as unknown[]).length} manual adjustment(s) pending
                    recalculation
                  </p>
                )}
              {runDetailQ.data && selectedRunId && (
                <div className="mt-3 max-h-32 overflow-auto text-xs text-muted-foreground">
                  {
                    (
                      runDetailQ.data.payslips as Array<{
                        staffProfile?: { fullName: string };
                        netSalary: number;
                      }>
                    ).length
                  }{' '}
                  payslips — see full statement below
                </div>
              )}
            </GlassCard>
          </div>
          {runDetailQ.data && selectedRunId && (
            <PayrollRunStatement runId={selectedRunId} run={runDetailQ.data as never} />
          )}
          {runDetailQ.data && selectedRunId && (
            <PayrollRunAdjustmentsPanel
              run={runDetailQ.data as never}
              onMessage={setMessage}
              onError={setError}
            />
          )}
        </div>
      )}

      {page === 'pf-cpf' && <HrPfManagementPage />}

      {page === 'payslips' && <PayslipsPage />}

      {page === 'reports' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-4">
            <h3 className="mb-3 font-semibold">Export Salary Sheets</h3>
            <select
              className="mb-2 w-full rounded border px-2 py-1 text-sm"
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
            >
              <option value="">Select payroll run</option>
              {(runsQ.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {MONTHS[r.month - 1]} {r.year} — {r.payScaleType}
                </option>
              ))}
            </select>
            <p className="mb-2 text-xs text-muted-foreground">Generic scale exports</p>
            <div className="flex flex-wrap gap-2">
              {['COLLEGE_TEACHING', 'COLLEGE_NON_TEACHING', 'UGC', 'STATE'].map((scale) => (
                <Button
                  key={scale}
                  size="sm"
                  variant="outline"
                  disabled={!selectedRunId}
                  onClick={() =>
                    exportBulkSalarySheet(
                      selectedRunId,
                      scale,
                      scale === 'COLLEGE_NON_TEACHING' ? 'DBC_NON_TEACHING' : undefined,
                    )
                  }
                >
                  <FileSpreadsheet className="mr-1 h-3 w-3" /> {scale.replace(/_/g, ' ')}
                </Button>
              ))}
            </div>
            <p className="mb-2 mt-3 text-xs text-muted-foreground">DBC institution layouts</p>
            <div className="flex flex-wrap gap-2">
              {[
                { scale: 'UGC', layout: 'DBC_UGC_7TH', label: 'DBC UGC' },
                { scale: 'COLLEGE_TEACHING', layout: 'DBC_TEACHING_LEGACY', label: 'DBC Teaching' },
                {
                  scale: 'COLLEGE_NON_TEACHING',
                  layout: 'DBC_NON_TEACHING',
                  label: 'DBC Non-Teaching',
                },
              ].map(({ scale, layout, label }) => (
                <Button
                  key={layout}
                  size="sm"
                  variant="outline"
                  disabled={!selectedRunId}
                  onClick={() => exportBulkSalarySheet(selectedRunId, scale, layout)}
                >
                  <FileSpreadsheet className="mr-1 h-3 w-3" /> {label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedRunId}
                onClick={() => exportSalaryRegister(selectedRunId)}
              >
                Salary Register
              </Button>
            </div>
            <h3 className="mb-2 mt-4 font-semibold">Bank Transfer File</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedRunId}
                onClick={() => exportBankTransferFile(selectedRunId, 'xlsx')}
              >
                <Banknote className="mr-1 h-3 w-3" /> Excel
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedRunId}
                onClick={() => exportBankTransferFile(selectedRunId, 'csv')}
              >
                <Banknote className="mr-1 h-3 w-3" /> CSV
              </Button>
            </div>
            <h3 className="mb-2 mt-4 font-semibold">Apply Arrears to Run</h3>
            <select
              className="mb-2 w-full rounded border px-2 py-1 text-sm"
              value={selectedArrearId}
              onChange={(e) => setSelectedArrearId(e.target.value)}
            >
              <option value="">Select arrear batch</option>
              {((arrearsQ.data as Array<{ id: string; name: string; status: string }>) ?? [])
                .filter((a) => a.status !== 'APPLIED')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.status})
                  </option>
                ))}
            </select>
            <Button
              size="sm"
              disabled={!selectedRunId || !selectedArrearId}
              onClick={() =>
                applyArrearMut.mutate({ arrearId: selectedArrearId, runId: selectedRunId })
              }
            >
              Apply Arrears
            </Button>
          </GlassCard>
          <GlassCard className="p-4">
            <h3 className="mb-3 font-semibold">Department-wise (Published)</h3>
            <ul className="space-y-1 text-sm">
              {(
                (deptQ.data as Array<{ department: string; count: number; net: number }>) ?? []
              ).map((d) => (
                <li key={d.department} className="flex justify-between">
                  <span>{d.department}</span>
                  <span>₹{d.net.toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
            <h3 className="mb-2 mt-4 font-semibold">Payroll Audit Trail</h3>
            <div className="max-h-48 space-y-1 overflow-auto text-xs">
              {(
                (auditLogsQ.data as Array<{
                  action: string;
                  entityType: string;
                  createdAt: string;
                }>) ?? []
              )
                .slice(0, 20)
                .map((log, i) => (
                  <div key={i} className="rounded border px-2 py-1">
                    {new Date(log.createdAt).toLocaleString()} — {log.action} ({log.entityType})
                  </div>
                ))}
            </div>
          </GlassCard>
        </div>
      )}

      {page === 'settings' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-4 space-y-3">
            <h3 className="font-semibold">Payroll Settings</h3>
            <textarea
              className="w-full rounded border px-2 py-1 text-sm"
              rows={3}
              placeholder="Payslip footer"
              defaultValue={settingsQ.data?.payslipFooter ?? ''}
              id="payslip-footer"
            />
            <Button
              size="sm"
              onClick={() =>
                settingsMut.mutate({
                  payslipFooter: (document.getElementById('payslip-footer') as HTMLTextAreaElement)
                    .value,
                })
              }
            >
              Save Footer
            </Button>
            <div className="border-t pt-3 space-y-2">
              <h4 className="text-sm font-medium">Payslip Signatory</h4>
              <p className="text-xs text-muted-foreground">
                Shown at the bottom-right of each payslip PDF. Logo uses Branding Studio or payroll
                logo when set.
              </p>
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                placeholder="Signatory name (optional)"
                defaultValue={
                  (
                    settingsQ.data?.exportLayouts as {
                      _payslipHeader?: { signatoryName?: string };
                    } | null
                  )?._payslipHeader?.signatoryName ?? ''
                }
                id="payslip-signatory-name"
              />
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                placeholder="Designation"
                defaultValue={
                  (
                    settingsQ.data?.exportLayouts as {
                      _payslipHeader?: { signatoryTitle?: string };
                    } | null
                  )?._payslipHeader?.signatoryTitle ?? 'Accounts Officer'
                }
                id="payslip-signatory-title"
              />
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                placeholder="Signatory label"
                defaultValue={
                  (
                    settingsQ.data?.exportLayouts as {
                      _payslipHeader?: { signatoryLabel?: string };
                    } | null
                  )?._payslipHeader?.signatoryLabel ?? 'Authorized Signatory'
                }
                id="payslip-signatory-label"
              />
              <Button
                size="sm"
                onClick={() => {
                  const layouts = (settingsQ.data?.exportLayouts ?? {}) as Record<string, unknown>;
                  const header = (layouts._payslipHeader ?? {}) as Record<string, string>;
                  settingsMut.mutate({
                    exportLayouts: {
                      ...layouts,
                      _payslipHeader: {
                        ...header,
                        signatoryName: (
                          document.getElementById('payslip-signatory-name') as HTMLInputElement
                        ).value.trim(),
                        signatoryTitle:
                          (
                            document.getElementById('payslip-signatory-title') as HTMLInputElement
                          ).value.trim() || 'Accounts Officer',
                        signatoryLabel:
                          (
                            document.getElementById('payslip-signatory-label') as HTMLInputElement
                          ).value.trim() || 'Authorized Signatory',
                      },
                    },
                  });
                }}
              >
                Save Signatory
              </Button>
            </div>
          </GlassCard>
          <GlassCard className="p-4 space-y-3">
            <h3 className="font-semibold">Professional Tax Slabs</h3>
            <p className="text-xs text-muted-foreground">
              Meghalaya default slabs apply when none are saved. PT is computed from monthly earning
              gross during payroll calculation. February is charged at double rate per state rules.
            </p>
            <textarea
              className="w-full rounded border px-2 py-1 font-mono text-xs"
              rows={10}
              id="pt-slabs-json"
              defaultValue={JSON.stringify(
                settingsQ.data?.professionalTaxSlabs ?? {
                  enabled: true,
                  state: 'MEGHALAYA',
                  doubleMonth: 2,
                  slabs: [
                    { minGross: 0, maxGross: 5000, amount: 0 },
                    { minGross: 5001, maxGross: 7500, amount: 110 },
                    { minGross: 7501, maxGross: 10000, amount: 130 },
                    { minGross: 10001, maxGross: 12500, amount: 150 },
                    { minGross: 12501, maxGross: 15000, amount: 180 },
                    { minGross: 15001, amount: 208 },
                  ],
                },
                null,
                2,
              )}
            />
            <Button
              size="sm"
              onClick={() => {
                try {
                  const professionalTaxSlabs = JSON.parse(
                    (document.getElementById('pt-slabs-json') as HTMLTextAreaElement).value,
                  );
                  settingsMut.mutate({ professionalTaxSlabs });
                } catch {
                  setError('Invalid PT slabs JSON');
                }
              }}
            >
              Save PT Slabs
            </Button>
            <div className="rounded border bg-muted/30 p-3 text-sm">
              <div className="mb-2 font-medium">PT Preview</div>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="w-full rounded border px-2 py-1 text-sm"
                  value={ptPreviewGross}
                  onChange={(e) => setPtPreviewGross(Number(e.target.value))}
                  placeholder="Monthly gross ₹"
                />
                <select
                  className="rounded border px-2 py-1 text-sm"
                  value={ptPreviewMonth}
                  onChange={(e) => setPtPreviewMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              {ptPreviewQ.data && (
                <p className="mt-2 text-sm">
                  PT for ₹{ptPreviewQ.data.grossSalary.toLocaleString('en-IN')} in{' '}
                  {MONTHS[ptPreviewMonth - 1]}:{' '}
                  <strong>₹{ptPreviewQ.data.amount.toLocaleString('en-IN')}</strong>
                  {ptPreviewQ.data.doubled && ' (February double month)'}
                </p>
              )}
            </div>
          </GlassCard>
          <GlassCard className="p-4 space-y-3 lg:col-span-2">
            <h3 className="font-semibold">TDS Slabs (New Regime FY 2024-25)</h3>
            <p className="text-xs text-muted-foreground">
              Monthly TDS is computed by annualizing taxable gross, applying slabs + 4% cess, then
              dividing by 12. Applied for CONTRACT/GUEST/VISITING staff and any structure with a TDS
              component.
            </p>
            <textarea
              className="w-full rounded border px-2 py-1 font-mono text-xs"
              rows={12}
              id="tds-slabs-json"
              defaultValue={JSON.stringify(
                settingsQ.data?.tdsSlabs ?? {
                  enabled: true,
                  regime: 'NEW',
                  standardDeduction: 75000,
                  cessRate: 4,
                  slabs: [
                    { minIncome: 0, maxIncome: 300000, rate: 0 },
                    { minIncome: 300001, maxIncome: 700000, rate: 5 },
                    { minIncome: 700001, maxIncome: 1000000, rate: 10 },
                    { minIncome: 1000001, maxIncome: 1200000, rate: 15 },
                    { minIncome: 1200001, maxIncome: 1500000, rate: 20 },
                    { minIncome: 1500001, rate: 30 },
                  ],
                },
                null,
                2,
              )}
            />
            <Button
              size="sm"
              onClick={() => {
                try {
                  const tdsSlabs = JSON.parse(
                    (document.getElementById('tds-slabs-json') as HTMLTextAreaElement).value,
                  );
                  settingsMut.mutate({ tdsSlabs });
                } catch {
                  setError('Invalid TDS slabs JSON');
                }
              }}
            >
              Save TDS Slabs
            </Button>
            <div className="rounded border bg-muted/30 p-3 text-sm">
              <div className="mb-2 font-medium">TDS Preview</div>
              <input
                type="number"
                className="w-full rounded border px-2 py-1 text-sm"
                value={tdsPreviewGross}
                onChange={(e) => setTdsPreviewGross(Number(e.target.value))}
                placeholder="Monthly taxable gross ₹"
              />
              {tdsPreviewQ.data && (
                <p className="mt-2 text-sm">
                  Monthly TDS:{' '}
                  <strong>₹{tdsPreviewQ.data.monthlyTds.toLocaleString('en-IN')}</strong>
                  {' · '}Annual tax (projected): ₹
                  {tdsPreviewQ.data.annualTax.toLocaleString('en-IN')}
                  {' · '}Regime: {tdsPreviewQ.data.regime}
                </p>
              )}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
