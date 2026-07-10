'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { openRazorpayCheckout } from '@/lib/razorpay-checkout';
import { api } from '@/services/api';
import {
  addExamBackPaper,
  collectExamManualPayment,
  completeExamOnlinePayment,
  createExamFeeMaster,
  createExamFeeSession,
  examReceiptPdfUrl,
  fetchExamApplications,
  fetchExamBackPapers,
  fetchExamFeeDashboard,
  fetchExamFeeMasters,
  fetchExamFeeSessions,
  fetchExamFeeSettings,
  fetchExamPayments,
  fetchExamReceipts,
  fetchExamReport,
  fetchExamVerification,
  fetchMyExamApplications,
  initiateExamOnlinePayment,
  removeExamBackPaper,
  seedExamFeeMasters,
  startExamApplication,
  submitExamApplication,
  updateExamFeeMaster,
  updateExamFeeSession,
  updateExamFeeSettings,
  verifyExamApplication,
} from '@/services/examination-fees';

export type ExamFeePage =
  | 'dashboard'
  | 'setup'
  | 'sessions'
  | 'applications'
  | 'back-papers'
  | 'payments'
  | 'manual'
  | 'verification'
  | 'exam-reports'
  | 'payment-reports'
  | 'receipts'
  | 'settings'
  | 'student';

function money(n: unknown) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toDateInput(value?: string | Date | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function Card({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function BarChart({
  title,
  rows,
  labelKey,
  valueKey,
}: {
  title: string;
  rows: any[];
  labelKey: string;
  valueKey: string;
}) {
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey] ?? 0)));
  return (
    <Section title={title}>
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No data yet.</p>
        ) : (
          rows.map((row) => {
            const value = Number(row[valueKey] ?? 0);
            const pct = Math.round((value / max) * 100);
            return (
              <div key={String(row[labelKey])}>
                <div className="mb-1 flex justify-between text-xs text-slate-600">
                  <span>{row[labelKey]}</span>
                  <span className="font-medium">{value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </Section>
  );
}

const REPORT_TABS = [
  { id: 'department-collection', label: 'Department collection' },
  { id: 'semester-collection', label: 'Semester collection' },
  { id: 'back-papers', label: 'Back paper summary' },
  { id: 'fee-heads', label: 'Fee head summary' },
  { id: 'daily-collection', label: 'Daily collection' },
  { id: 'pending-payments', label: 'Pending payments' },
  { id: 'manual-payments', label: 'Manual payments' },
  { id: 'online-payments', label: 'Online payments' },
  { id: 'cancelled-receipts', label: 'Cancelled receipts' },
] as const;

export function ExaminationFeesWorkspace({ page }: { page: ExamFeePage }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [masters, setMasters] = useState<any[]>([]);
  const [editingMaster, setEditingMaster] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [applications, setApplications] = useState<any>({ items: [] });
  const [backPapers, setBackPapers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [verification, setVerification] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [reportTab, setReportTab] = useState<string>('department-collection');
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [studentApp, setStudentApp] = useState<any>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [declaration, setDeclaration] = useState(false);
  const [paying, setPaying] = useState(false);
  const [backForm, setBackForm] = useState({
    semesterNo: 1,
    subjectCode: '',
    subjectName: '',
    examPaperType: 'THEORY_ONLY',
  });
  const [manualForm, setManualForm] = useState({
    applicationId: '',
    paymentMode: 'CASH',
    externalReference: '',
    remarks: '',
  });
  const [sessionForm, setSessionForm] = useState({
    name: 'NEHU Semester Examination',
    academicYearLabel: '2026-2027',
    semesterCycle: 'ODD',
    applicableSemesters: '1,3,5',
    applicationStartDate: '',
    applicationEndDate: '',
    lateFeeDate: '',
    status: 'DRAFT',
  });

  const activeSessionId = useMemo(
    () => sessions.find((s) => s.status === 'ACTIVE')?.id as string | undefined,
    [sessions],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (page === 'dashboard') {
        const sess = await fetchExamFeeSessions();
        setSessions(sess);
        const active = sess.find((s: any) => s.status === 'ACTIVE')?.id;
        setDashboard(await fetchExamFeeDashboard(active));
      } else if (page === 'setup') {
        setMasters(await fetchExamFeeMasters());
      } else if (page === 'sessions') {
        setSessions(await fetchExamFeeSessions());
      } else if (page === 'settings') {
        setSettings(await fetchExamFeeSettings());
      } else if (page === 'applications' || page === 'manual') {
        setApplications(await fetchExamApplications({ pageSize: 50 }));
      } else if (page === 'back-papers') {
        setBackPapers(await fetchExamBackPapers());
      } else if (page === 'payments' || page === 'payment-reports') {
        setPayments(await fetchExamPayments());
      } else if (page === 'verification') {
        setVerification(await fetchExamVerification());
      } else if (page === 'receipts') {
        setReceipts(await fetchExamReceipts());
      } else if (page === 'exam-reports') {
        setReportRows(await fetchExamReport(reportTab));
      } else if (page === 'student') {
        const [sess, mine] = await Promise.all([fetchExamFeeSessions(), fetchMyExamApplications()]);
        setSessions(sess);
        const current = Array.isArray(mine) && mine.length ? mine[0] : null;
        setStudentApp(current);
        if (current?.status === 'AWAITING_PAYMENT') setWizardStep(3);
        else if (current?.declarationAccepted) setWizardStep(2);
        else if ((current?.backPapers?.length ?? 0) > 0) setWizardStep(1);
        else setWizardStep(0);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [page, reportTab]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function payOnline(app: any) {
    if (!window.confirm(`Proceed to pay ${money(app.totalFee)} for examination fees?`)) {
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const initiated = await initiateExamOnlinePayment(app.id);
      const checkout = initiated.checkout;
      if (checkout?.mode === 'SAFE_MOCK' && checkout.paymentId) {
        const completed = await completeExamOnlinePayment(app.id, {
          paymentTransactionId: checkout.paymentTransactionId ?? checkout.paymentId,
        });
        setStudentApp(completed.application);
        await reload();
        return;
      }
      if (!checkout?.keyId || !checkout?.orderId) {
        throw new Error(
          'Online payment is not configured. Activate a gateway under Administration → Payment Gateway.',
        );
      }
      await openRazorpayCheckout({
        keyId: checkout.keyId,
        orderId: checkout.orderId,
        amount: Number(checkout.amount ?? app.totalFee),
        currency: checkout.currency ?? 'INR',
        name: 'Examination Fee',
        description: `Exam fee ${app.applicationNo}`,
        onSuccess: async (response) => {
          const completed = await completeExamOnlinePayment(app.id, {
            paymentTransactionId: checkout.paymentTransactionId ?? checkout.paymentId,
            ...response,
          });
          setStudentApp(completed.application);
          await reload();
        },
      });
    } catch (e: any) {
      const msg = e?.message ?? 'Payment failed';
      if (msg !== 'Payment cancelled') setError(msg);
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-slate-600">Loading examination fees…</div>;
  }

  return (
    <div className="space-y-5 p-1">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {page === 'dashboard' && dashboard ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card title="Current Session" value={dashboard.cards.currentSession} />
            <Card title="Applications Submitted" value={dashboard.cards.applicationsSubmitted} />
            <Card title="Pending Payments" value={dashboard.cards.pendingPayments} />
            <Card title="Paid Applications" value={dashboard.cards.paidApplications} />
            <Card title="Manual Payments" value={dashboard.cards.manualPayments} />
            <Card title="Total Collection" value={money(dashboard.cards.totalCollection)} />
            <Card
              title="Students with Back Papers"
              value={dashboard.cards.studentsWithBackPapers}
            />
            <Card
              title="Online Success Rate"
              value={`${dashboard.cards.onlinePaymentSuccessRate}%`}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <BarChart
              title="Department-wise Applications"
              rows={dashboard.charts.departmentWise ?? []}
              labelKey="name"
              valueKey="count"
            />
            <BarChart
              title="Semester-wise Applications"
              rows={dashboard.charts.semesterWise ?? []}
              labelKey="semester"
              valueKey="count"
            />
            <BarChart
              title="Payment Status"
              rows={dashboard.charts.paymentStatus ?? []}
              labelKey="status"
              valueKey="count"
            />
            <BarChart
              title="Daily Collection"
              rows={dashboard.charts.dailyCollection ?? []}
              labelKey="date"
              valueKey="amount"
            />
          </div>
        </>
      ) : null}

      {page === 'setup' ? (
        <Section
          title="Examination Fee Master"
          action={
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                onClick={async () => {
                  await seedExamFeeMasters();
                  await reload();
                }}
              >
                Seed defaults
              </button>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={async () => {
                  await createExamFeeMaster({
                    name: `Exam Fee Schedule ${new Date().getFullYear()}`,
                    isActive: true,
                  });
                  await reload();
                }}
              >
                New schedule
              </button>
            </div>
          }
        >
          <p className="mb-4 text-sm text-slate-600">
            Edit amounts below. Never hardcode fees in application logic.
          </p>
          <div className="space-y-4">
            {masters.map((master) => {
              const isEditing = editingMaster?.id === master.id;
              const draft = isEditing ? editingMaster : master;
              return (
                <div key={master.id} className="rounded-xl border p-4">
                  <div className="mb-3 flex flex-wrap items-end gap-3">
                    <label className="text-sm">
                      Name
                      <input
                        className="mt-1 block w-64 rounded border px-2 py-1"
                        value={draft.name}
                        disabled={!isEditing}
                        onChange={(e) => setEditingMaster({ ...draft, name: e.target.value })}
                      />
                    </label>
                    <label className="text-sm">
                      Academic year
                      <input
                        className="mt-1 block w-40 rounded border px-2 py-1"
                        value={draft.academicYearLabel ?? ''}
                        disabled={!isEditing}
                        onChange={(e) =>
                          setEditingMaster({ ...draft, academicYearLabel: e.target.value })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Effective from
                      <input
                        type="date"
                        className="mt-1 block rounded border px-2 py-1"
                        value={toDateInput(draft.effectiveFrom)}
                        disabled={!isEditing}
                        onChange={(e) =>
                          setEditingMaster({ ...draft, effectiveFrom: e.target.value })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Effective to
                      <input
                        type="date"
                        className="mt-1 block rounded border px-2 py-1"
                        value={toDateInput(draft.effectiveTo)}
                        disabled={!isEditing}
                        onChange={(e) =>
                          setEditingMaster({ ...draft, effectiveTo: e.target.value })
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!draft.isActive}
                        disabled={!isEditing}
                        onChange={(e) => setEditingMaster({ ...draft, isActive: e.target.checked })}
                      />
                      Active
                    </label>
                    {!isEditing ? (
                      <button
                        type="button"
                        className="rounded bg-blue-700 px-3 py-1 text-sm text-white"
                        onClick={() =>
                          setEditingMaster({
                            ...master,
                            lines: master.lines.map((l: any) => ({ ...l })),
                          })
                        }
                      >
                        Edit
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="rounded bg-emerald-700 px-3 py-1 text-sm text-white"
                          onClick={async () => {
                            await updateExamFeeMaster(master.id, {
                              name: draft.name,
                              academicYearLabel: draft.academicYearLabel || undefined,
                              effectiveFrom: draft.effectiveFrom || undefined,
                              effectiveTo: draft.effectiveTo || undefined,
                              isActive: draft.isActive,
                              lines: (draft.lines ?? []).map((l: any) => ({
                                headCode: l.headCode,
                                headName: l.headName,
                                amount: Number(l.amount),
                                unit: l.unit,
                                sortOrder: l.sortOrder,
                                isActive: l.isActive !== false,
                              })),
                            });
                            setEditingMaster(null);
                            await reload();
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="rounded border px-3 py-1 text-sm"
                          onClick={() => setEditingMaster(null)}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-1">Fee Head</th>
                        <th>Unit</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(draft.lines ?? []).map((line: any, idx: number) => (
                        <tr key={line.id ?? line.headCode} className="border-t">
                          <td className="py-2">{line.headName}</td>
                          <td>{line.unit}</td>
                          <td className="text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                className="w-28 rounded border px-2 py-1 text-right"
                                value={line.amount}
                                onChange={(e) => {
                                  const lines = [...draft.lines];
                                  lines[idx] = { ...line, amount: e.target.value };
                                  setEditingMaster({ ...draft, lines });
                                }}
                              />
                            ) : (
                              money(line.amount)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {page === 'sessions' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Create Session">
            <div className="space-y-3 text-sm">
              <label className="block">
                Name
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={sessionForm.name}
                  onChange={(e) => setSessionForm((s) => ({ ...s, name: e.target.value }))}
                />
              </label>
              <label className="block">
                Academic Year
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={sessionForm.academicYearLabel}
                  onChange={(e) =>
                    setSessionForm((s) => ({ ...s, academicYearLabel: e.target.value }))
                  }
                />
              </label>
              <label className="block">
                Semester Cycle
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={sessionForm.semesterCycle}
                  onChange={(e) =>
                    setSessionForm((s) => ({
                      ...s,
                      semesterCycle: e.target.value,
                      applicableSemesters: e.target.value === 'EVEN' ? '2,4,6' : '1,3,5',
                    }))
                  }
                >
                  <option value="ODD">Odd Semester</option>
                  <option value="EVEN">Even Semester</option>
                </select>
              </label>
              <label className="block">
                Applicable Semesters
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={sessionForm.applicableSemesters}
                  onChange={(e) =>
                    setSessionForm((s) => ({ ...s, applicableSemesters: e.target.value }))
                  }
                />
              </label>
              <label className="block">
                Application Start Date
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={sessionForm.applicationStartDate}
                  onChange={(e) =>
                    setSessionForm((s) => ({ ...s, applicationStartDate: e.target.value }))
                  }
                />
              </label>
              <label className="block">
                Application End Date
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={sessionForm.applicationEndDate}
                  onChange={(e) =>
                    setSessionForm((s) => ({ ...s, applicationEndDate: e.target.value }))
                  }
                />
              </label>
              <label className="block">
                Late Fee Date
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={sessionForm.lateFeeDate}
                  onChange={(e) => setSessionForm((s) => ({ ...s, lateFeeDate: e.target.value }))}
                />
              </label>
              <button
                type="button"
                className="rounded-lg bg-blue-700 px-3 py-2 text-white"
                onClick={async () => {
                  await createExamFeeSession({
                    name: sessionForm.name,
                    academicYearLabel: sessionForm.academicYearLabel,
                    semesterCycle: sessionForm.semesterCycle,
                    applicableSemesters: sessionForm.applicableSemesters
                      .split(',')
                      .map((x) => Number(x.trim()))
                      .filter(Boolean),
                    applicationStartDate: sessionForm.applicationStartDate || undefined,
                    applicationEndDate: sessionForm.applicationEndDate || undefined,
                    lateFeeDate: sessionForm.lateFeeDate || undefined,
                    status: 'DRAFT',
                  });
                  await reload();
                }}
              >
                Create session
              </button>
            </div>
          </Section>
          <Section title="Sessions">
            <ul className="space-y-3">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-xl border p-3 text-sm">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-slate-500">
                    {s.academicYearLabel} · {s.semesterCycle} · {s.status}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Open: {toDateInput(s.applicationStartDate) || '—'} →{' '}
                    {toDateInput(s.applicationEndDate) || '—'} · Late:{' '}
                    {toDateInput(s.lateFeeDate) || '—'}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.status !== 'ACTIVE' ? (
                      <button
                        type="button"
                        className="rounded bg-emerald-700 px-2 py-1 text-xs text-white"
                        onClick={async () => {
                          await updateExamFeeSession(s.id, { status: 'ACTIVE' });
                          await reload();
                        }}
                      >
                        Activate
                      </button>
                    ) : null}
                    {s.status !== 'CLOSED' ? (
                      <button
                        type="button"
                        className="rounded bg-slate-700 px-2 py-1 text-xs text-white"
                        onClick={async () => {
                          await updateExamFeeSession(s.id, { status: 'CLOSED' });
                          await reload();
                        }}
                      >
                        Close
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs"
                      onClick={async () => {
                        const start =
                          window.prompt(
                            'Application start (YYYY-MM-DD)',
                            toDateInput(s.applicationStartDate),
                          ) ?? undefined;
                        const end =
                          window.prompt(
                            'Application end (YYYY-MM-DD)',
                            toDateInput(s.applicationEndDate),
                          ) ?? undefined;
                        const late =
                          window.prompt('Late fee date (YYYY-MM-DD)', toDateInput(s.lateFeeDate)) ??
                          undefined;
                        await updateExamFeeSession(s.id, {
                          applicationStartDate: start || null,
                          applicationEndDate: end || null,
                          lateFeeDate: late || null,
                        } as any);
                        await reload();
                      }}
                    >
                      Edit dates
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      ) : null}

      {page === 'applications' ? (
        <Section title="Student Examination Applications">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Application</th>
                <th>Dept</th>
                <th>Sem</th>
                <th>Status</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(applications.items ?? []).map((app: any) => (
                <tr key={app.id} className="border-t">
                  <td className="py-2">{app.applicationNo}</td>
                  <td>{app.departmentName ?? '—'}</td>
                  <td>{app.currentSemesterNo}</td>
                  <td>{app.status}</td>
                  <td className="text-right">{money(app.totalFee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {page === 'back-papers' ? (
        <Section title="Back Paper Selection">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Application</th>
                <th>Sem</th>
                <th>Code</th>
                <th>Type</th>
                <th className="text-right">Fee</th>
              </tr>
            </thead>
            <tbody>
              {backPapers.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="py-2">{row.application?.applicationNo}</td>
                  <td>{row.semesterNo}</td>
                  <td>
                    {row.subjectCode} — {row.subjectName}
                  </td>
                  <td>{row.examPaperType}</td>
                  <td className="text-right">{money(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {page === 'payments' ? (
        <Section
          title="Examination Payments"
          action={
            <Link
              href="/admin/administration/payment-gateway"
              className="text-sm text-blue-700 underline"
            >
              Gateway settings
            </Link>
          }
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Application</th>
                <th>Channel</th>
                <th>Provider</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2">{p.application?.applicationNo}</td>
                  <td>{p.channel}</td>
                  <td>{p.provider ?? p.paymentMode}</td>
                  <td>{p.status}</td>
                  <td className="text-right">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {page === 'manual' ? (
        <Section title="Manual Fee Collection">
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <label className="block">
              Application ID
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={manualForm.applicationId}
                onChange={(e) => setManualForm((s) => ({ ...s, applicationId: e.target.value }))}
                list="exam-apps"
              />
              <datalist id="exam-apps">
                {(applications.items ?? []).map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.applicationNo}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="block">
              Mode
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={manualForm.paymentMode}
                onChange={(e) => setManualForm((s) => ({ ...s, paymentMode: e.target.value }))}
              >
                {['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'DD'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Reference
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={manualForm.externalReference}
                onChange={(e) =>
                  setManualForm((s) => ({ ...s, externalReference: e.target.value }))
                }
              />
            </label>
            <label className="block">
              Remarks
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={manualForm.remarks}
                onChange={(e) => setManualForm((s) => ({ ...s, remarks: e.target.value }))}
              />
            </label>
          </div>
          <button
            type="button"
            className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white"
            onClick={async () => {
              await collectExamManualPayment(manualForm.applicationId, {
                paymentMode: manualForm.paymentMode,
                externalReference: manualForm.externalReference || undefined,
                remarks: manualForm.remarks || undefined,
              });
              await reload();
            }}
          >
            Collect & issue receipt
          </button>
        </Section>
      ) : null}

      {page === 'verification' ? (
        <Section title="Fee Verification">
          <div className="space-y-3">
            {verification.map((app) => (
              <div key={app.id} className="rounded-xl border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{app.applicationNo}</div>
                    <div className="text-slate-500">
                      {app.departmentName} · Sem {app.currentSemesterNo} · {money(app.totalFee)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-emerald-700 px-2 py-1 text-xs text-white"
                      onClick={async () => {
                        await verifyExamApplication(app.id, { action: 'APPROVE' });
                        await reload();
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="rounded bg-amber-600 px-2 py-1 text-xs text-white"
                      onClick={async () => {
                        await verifyExamApplication(app.id, {
                          action: 'REQUEST_CORRECTION',
                          remarks: 'Please correct back paper selection',
                        });
                        await reload();
                      }}
                    >
                      Request correction
                    </button>
                    <button
                      type="button"
                      className="rounded bg-red-700 px-2 py-1 text-xs text-white"
                      onClick={async () => {
                        await verifyExamApplication(app.id, {
                          action: 'REJECT',
                          remarks: 'Rejected by office',
                        });
                        await reload();
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {page === 'exam-reports' ? (
        <Section title="Examination Reports">
          <div className="mb-4 flex flex-wrap gap-2">
            {REPORT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`rounded-full px-3 py-1 text-xs ${reportTab === tab.id ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'}`}
                onClick={() => setReportTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <pre className="overflow-auto rounded-xl bg-slate-50 p-3 text-xs">
            {JSON.stringify(reportRows, null, 2)}
          </pre>
        </Section>
      ) : null}

      {page === 'payment-reports' ? (
        <Section title="Payment Report">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Application</th>
                <th>Channel</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2">{p.application?.applicationNo}</td>
                  <td>{p.channel}</td>
                  <td>{p.status}</td>
                  <td className="text-right">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {page === 'receipts' ? (
        <Section title="Receipt Management">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Receipt</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2">{r.receiptNo}</td>
                  <td>{r.status}</td>
                  <td className="text-right">{money(r.amount)}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="text-blue-700 underline"
                      onClick={async () => {
                        const res = await api.get(examReceiptPdfUrl(r.id), {
                          responseType: 'blob',
                        });
                        window.open(URL.createObjectURL(res.data), '_blank');
                      }}
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {page === 'settings' && settings ? (
        <Section title="Examination Settings">
          <div className="grid max-w-xl gap-3 text-sm">
            <label className="block">
              Receipt prefix
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={settings.receiptPrefix ?? ''}
                onChange={(e) => setSettings((s: any) => ({ ...s, receiptPrefix: e.target.value }))}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.requireDeclaration}
                onChange={(e) =>
                  setSettings((s: any) => ({ ...s, requireDeclaration: e.target.checked }))
                }
              />
              Require student declaration
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.autoVerifyOnPayment}
                onChange={(e) =>
                  setSettings((s: any) => ({ ...s, autoVerifyOnPayment: e.target.checked }))
                }
              />
              Auto-approve after payment
            </label>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-3 py-2 text-white"
              onClick={async () => {
                await updateExamFeeSettings({
                  receiptPrefix: settings.receiptPrefix,
                  requireDeclaration: settings.requireDeclaration,
                  autoVerifyOnPayment: settings.autoVerifyOnPayment,
                });
                await reload();
              }}
            >
              Save settings
            </button>
          </div>
        </Section>
      ) : null}

      {page === 'student' ? (
        <StudentWizard
          sessions={sessions}
          app={studentApp}
          setApp={setStudentApp}
          step={wizardStep}
          setStep={setWizardStep}
          declaration={declaration}
          setDeclaration={setDeclaration}
          backForm={backForm}
          setBackForm={setBackForm}
          paying={paying}
          onPay={payOnline}
          onReload={reload}
          activeSessionId={activeSessionId}
        />
      ) : null}
    </div>
  );
}

function StudentWizard(props: {
  sessions: any[];
  app: any;
  setApp: (v: any) => void;
  step: number;
  setStep: (n: number) => void;
  declaration: boolean;
  setDeclaration: (v: boolean) => void;
  backForm: any;
  setBackForm: (v: any) => void;
  paying: boolean;
  onPay: (app: any) => Promise<void>;
  onReload: () => Promise<void>;
  activeSessionId?: string;
}) {
  const steps = ['Current subjects', 'Back papers', 'Summary', 'Payment'];
  const app = props.app;
  const active = props.sessions.find((s) => s.status === 'ACTIVE');

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <Section title="Semester Examination Application">
          <div className="mb-4 flex flex-wrap gap-2">
            {steps.map((label, idx) => (
              <div
                key={label}
                className={`rounded-full px-3 py-1 text-xs font-medium ${props.step === idx ? 'bg-blue-700 text-white' : props.step > idx ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
              >
                {idx + 1}. {label}
              </div>
            ))}
          </div>

          {!app ? (
            <button
              type="button"
              disabled={!active}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50"
              onClick={async () => {
                const created = await startExamApplication(active.id);
                props.setApp(created);
                props.setStep(0);
              }}
            >
              {active ? `Apply for ${active.name}` : 'No active examination session'}
            </button>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="font-semibold">{app.applicationNo}</div>
                <div className="text-slate-600">
                  Semester {app.currentSemesterNo} · {app.departmentName} · {app.status}
                </div>
              </div>

              {props.step === 0 ? (
                <div>
                  <h3 className="mb-2 font-semibold">Current Subjects (auto from registration)</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(app.currentSubjects ?? []).map((s: any) => (
                      <div key={s.id ?? s.subjectCode} className="rounded-xl border p-3">
                        <div className="font-medium">
                          {s.subjectCode} · {s.subjectName}
                        </div>
                        <div className="text-slate-500">
                          {s.examPaperType === 'THEORY_PRACTICAL' ? 'Theory + Practical' : 'Theory'}{' '}
                          · {money(s.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-white"
                    onClick={() => props.setStep(1)}
                  >
                    Continue to back papers
                  </button>
                </div>
              ) : null}

              {props.step === 1 ? (
                <div>
                  <h3 className="mb-2 font-semibold">Back Papers</h3>
                  <div className="mb-3 space-y-2">
                    {(app.backPapers ?? []).map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border px-3 py-2"
                      >
                        <span>
                          Sem {p.semesterNo} · {p.subjectCode} · {money(p.amount)}
                        </span>
                        <button
                          type="button"
                          className="text-red-600"
                          onClick={async () => {
                            const updated = await removeExamBackPaper(app.id, p.id);
                            props.setApp(updated);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
                    <input
                      className="rounded border px-2 py-1"
                      type="number"
                      value={props.backForm.semesterNo}
                      onChange={(e) =>
                        props.setBackForm({ ...props.backForm, semesterNo: Number(e.target.value) })
                      }
                      placeholder="Semester"
                    />
                    <select
                      className="rounded border px-2 py-1"
                      value={props.backForm.examPaperType}
                      onChange={(e) =>
                        props.setBackForm({ ...props.backForm, examPaperType: e.target.value })
                      }
                    >
                      <option value="THEORY_ONLY">Theory Only</option>
                      <option value="THEORY_PRACTICAL">Theory + Practical</option>
                    </select>
                    <input
                      className="rounded border px-2 py-1"
                      placeholder="Subject code"
                      value={props.backForm.subjectCode}
                      onChange={(e) =>
                        props.setBackForm({ ...props.backForm, subjectCode: e.target.value })
                      }
                    />
                    <input
                      className="rounded border px-2 py-1"
                      placeholder="Subject name"
                      value={props.backForm.subjectName}
                      onChange={(e) =>
                        props.setBackForm({ ...props.backForm, subjectName: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="rounded bg-slate-900 px-3 py-2 text-white sm:col-span-2"
                      onClick={async () => {
                        const updated = await addExamBackPaper(app.id, props.backForm);
                        props.setApp(updated);
                      }}
                    >
                      Add Back Paper
                    </button>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      className="rounded border px-4 py-2"
                      onClick={() => props.setStep(0)}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-blue-700 px-4 py-2 text-white"
                      onClick={() => props.setStep(2)}
                    >
                      Continue to summary
                    </button>
                  </div>
                </div>
              ) : null}

              {props.step === 2 ? (
                <div className="space-y-3 rounded-xl border p-3">
                  <p>Review fee summary on the right, then declare and submit.</p>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={props.declaration}
                      onChange={(e) => props.setDeclaration(e.target.checked)}
                    />
                    <span>
                      I declare that all selected backlog papers are correct. I understand that
                      incorrect subject selection may lead to rejection by the university.
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded border px-4 py-2"
                      onClick={() => props.setStep(1)}
                    >
                      Back
                    </button>
                    {['DRAFT', 'CORRECTION_REQUESTED'].includes(app.status) ? (
                      <button
                        type="button"
                        className="rounded-lg bg-blue-700 px-4 py-2 text-white"
                        onClick={async () => {
                          const updated = await submitExamApplication(app.id, props.declaration);
                          props.setApp(updated);
                          props.setStep(3);
                        }}
                      >
                        Submit application
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded-lg bg-blue-700 px-4 py-2 text-white"
                        onClick={() => props.setStep(3)}
                      >
                        Proceed to payment
                      </button>
                    )}
                  </div>
                </div>
              ) : null}

              {props.step === 3 ? (
                <div className="space-y-3">
                  {app.status === 'AWAITING_PAYMENT' ? (
                    <button
                      type="button"
                      disabled={props.paying}
                      className="sticky bottom-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white shadow-lg disabled:opacity-60"
                      onClick={() => props.onPay(app)}
                    >
                      {props.paying ? 'Processing…' : `Proceed to Payment · ${money(app.totalFee)}`}
                    </button>
                  ) : (
                    <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
                      Status: {app.status}
                    </div>
                  )}
                  {(app.receipts ?? []).length ? (
                    <button
                      type="button"
                      className="text-blue-700 underline"
                      onClick={async () => {
                        const res = await api.get(examReceiptPdfUrl(app.receipts[0].id), {
                          responseType: 'blob',
                        });
                        window.open(URL.createObjectURL(res.data), '_blank');
                      }}
                    >
                      Download / reprint receipt
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </Section>
      </div>
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4">
        <h3 className="font-semibold text-slate-900">Fee Summary</h3>
        {app ? (
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Current Semester</dt>
              <dd>{money(app.currentSemesterFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Back Papers</dt>
              <dd>{money(app.backPaperFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Processing</dt>
              <dd>{money(app.processingFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Late Fee</dt>
              <dd>{money(app.lateFee)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{money(app.totalFee)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Start an application to see fees.</p>
        )}
      </aside>
    </div>
  );
}
