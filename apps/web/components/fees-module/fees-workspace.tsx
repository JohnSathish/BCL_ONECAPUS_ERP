'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  FileText,
  Layers3,
  LineChart,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  collectFee,
  createFeeStructure,
  fetchFeeDashboard,
  fetchFeeReport,
  fetchFeeStructures,
  fetchMyFeeLedger,
  fetchStudentFeeLedger,
  generateFeeDemand,
  generateRenewal,
  initiateOnlinePayment,
  previewFeeDemand,
  previewRenewal,
  publishFeeStructure,
  type FeeDemandScope,
} from '@/services/fees';
import type { FeeDashboard, FeeDemandPreview, FeeStructure, StudentFeeLedger } from '@/types/fees';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type FeesPage =
  | 'dashboard'
  | 'structures'
  | 'renewals'
  | 'demands'
  | 'collections'
  | 'ledger'
  | 'reports'
  | 'defaulters'
  | 'student';

export function FeesWorkspace({
  page = 'dashboard',
  portal = 'admin',
}: {
  page?: FeesPage;
  portal?: 'admin' | 'accountant' | 'student';
}) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [studentId, setStudentId] = useState('');
  const [demandScope, setDemandScope] = useState<FeeDemandScope>({
    semesterNumber: 1,
    billingLayer: 'YEARLY',
    demandType: 'GENERAL',
    publish: false,
  });
  const [structureForm, setStructureForm] = useState({
    code: 'FYUGP-Y1-ARTS',
    name: 'FYUGP Year 1 Arts Fee Structure',
    category: 'ADMISSION',
    billingFrequency: 'YEARLY',
    componentName: 'Session / Renewal Fee',
    componentCode: 'SESSION-FEE',
    componentAmount: 2500,
  });
  const [collection, setCollection] = useState({ studentId: '', amount: 0, paymentMode: 'CASH' });

  const dashboardQ = useQuery({ queryKey: ['fees', 'dashboard'], queryFn: fetchFeeDashboard });
  const structuresQ = useQuery({
    queryKey: ['fees', 'structures'],
    queryFn: () => fetchFeeStructures(),
  });
  const studentLedgerQ = useQuery({
    queryKey: ['fees', portal === 'student' ? 'me' : studentId, 'ledger'],
    queryFn: () => (portal === 'student' ? fetchMyFeeLedger() : fetchStudentFeeLedger(studentId)),
    enabled: portal === 'student' || Boolean(studentId),
  });
  const reportQ = useQuery({
    queryKey: ['fees', 'report', page],
    queryFn: () => fetchFeeReport(page === 'defaulters' ? 'defaulters' : 'collections'),
    enabled: page === 'reports' || page === 'defaulters',
  });

  const previewMut = useMutation({
    mutationFn: page === 'renewals' ? previewRenewal : previewFeeDemand,
    onSuccess: () =>
      setMessage('Preview generated. Review duplicate and charge lines before publishing.'),
    onError: (err) => setError(apiErrorMessage(err, 'Unable to preview fee demand.')),
  });

  const generateMut = useMutation({
    mutationFn: page === 'renewals' ? generateRenewal : generateFeeDemand,
    onSuccess: (result) => {
      setMessage(`Generated ${result.createdCount} demand(s), skipped ${result.skippedCount}.`);
      void qc.invalidateQueries({ queryKey: ['fees'] });
    },
    onError: (err) => setError(apiErrorMessage(err, 'Unable to generate fee demands.')),
  });

  const createStructureMut = useMutation({
    mutationFn: () =>
      createFeeStructure({
        code: structureForm.code,
        name: structureForm.name,
        category: structureForm.category,
        billingFrequency: structureForm.billingFrequency,
        components: [
          {
            code: structureForm.componentCode,
            name: structureForm.componentName,
            category: structureForm.category,
            amount: Number(structureForm.componentAmount),
            billingFrequency: structureForm.billingFrequency,
            semesterNumbers: demandScope.semesterNumber ? [Number(demandScope.semesterNumber)] : [],
          },
        ],
      }),
    onSuccess: () => {
      setMessage('Fee structure saved as draft.');
      void qc.invalidateQueries({ queryKey: ['fees', 'structures'] });
    },
    onError: (err) => setError(apiErrorMessage(err, 'Unable to save fee structure.')),
  });

  const collectMut = useMutation({
    mutationFn: () => collectFee({ ...collection, amount: Number(collection.amount) }),
    onSuccess: () => {
      setMessage('Payment collected, allocated, receipted, and posted to ledger.');
      void qc.invalidateQueries({ queryKey: ['fees'] });
    },
    onError: (err) => setError(apiErrorMessage(err, 'Unable to collect payment.')),
  });

  const onlineMut = useMutation({
    mutationFn: () =>
      initiateOnlinePayment({
        studentId: collection.studentId,
        amount: Number(collection.amount),
        provider: 'RAZORPAY',
      }),
    onSuccess: () => setMessage('Online gateway order prepared in safe mock mode.'),
    onError: (err) => setError(apiErrorMessage(err, 'Unable to initiate online payment.')),
  });

  const visiblePage = portal === 'student' ? 'student' : page;

  return (
    <div className="space-y-5">
      <FeesHero dashboard={dashboardQ.data} loading={dashboardQ.isLoading} portal={portal} />
      <StatusMessage
        message={message}
        error={error}
        onClear={() => {
          setMessage('');
          setError('');
        }}
      />

      {(visiblePage === 'dashboard' || portal === 'accountant') && (
        <DashboardPanel dashboard={dashboardQ.data} structures={structuresQ.data ?? []} />
      )}

      {visiblePage === 'structures' && (
        <StructureStudio
          form={structureForm}
          setForm={setStructureForm}
          structures={structuresQ.data ?? []}
          onCreate={() => createStructureMut.mutate()}
          onPublish={(id: string) =>
            publishFeeStructure(id)
              .then(() => {
                setMessage('Fee structure published.');
                void qc.invalidateQueries({ queryKey: ['fees', 'structures'] });
              })
              .catch((err) => setError(apiErrorMessage(err, 'Unable to publish fee structure.')))
          }
        />
      )}

      {(visiblePage === 'demands' || visiblePage === 'renewals') && (
        <DemandGenerator
          mode={visiblePage}
          scope={demandScope}
          setScope={setDemandScope}
          preview={previewMut.data}
          loading={previewMut.isPending || generateMut.isPending}
          onPreview={() => previewMut.mutate(demandScope)}
          onGenerate={() => generateMut.mutate(demandScope)}
        />
      )}

      {visiblePage === 'collections' && (
        <CollectionConsole
          form={collection}
          setForm={setCollection}
          loading={collectMut.isPending || onlineMut.isPending}
          onCollect={() => collectMut.mutate()}
          onOnline={() => onlineMut.mutate()}
        />
      )}

      {(visiblePage === 'ledger' || visiblePage === 'student') && (
        <LedgerExplorer
          studentId={studentId}
          setStudentId={setStudentId}
          ledger={studentLedgerQ.data}
          studentPortal={portal === 'student'}
        />
      )}

      {(visiblePage === 'reports' || visiblePage === 'defaulters') && (
        <ReportsPanel type={visiblePage} dashboard={dashboardQ.data} report={reportQ.data} />
      )}
    </div>
  );
}

function FeesHero({
  dashboard,
  loading,
  portal,
}: {
  dashboard?: FeeDashboard;
  loading: boolean;
  portal: string;
}) {
  const kpis = dashboard?.kpis;
  const cards = [
    {
      label: 'Today Collection',
      value: money(kpis?.todayCollection),
      icon: CircleDollarSign,
      tone: 'text-emerald-600',
    },
    {
      label: 'Outstanding',
      value: money(kpis?.outstanding),
      icon: AlertTriangle,
      tone: 'text-rose-600',
    },
    {
      label: 'Renewal Pending',
      value: kpis?.renewalPending ?? 0,
      icon: RefreshCw,
      tone: 'text-orange-600',
    },
    { label: 'Receipts', value: kpis?.receiptCount ?? 0, icon: ReceiptText, tone: 'text-blue-600' },
  ];
  return (
    <section className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Higher Education Finance Intelligence
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {portal === 'student' ? 'My Fee Account' : 'FYUGP / CBCS Fees Management'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Yearly renewal admission fees, monthly billing, programme-wise charges, subject
            practical fees, collections, receipts, and accounting-ready student ledgers.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Ledger-first and audit-ready
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm"
            >
              <Icon className={cn('mb-3 h-5 w-5', card.tone)} />
              <p className="text-xl font-semibold">{loading ? '...' : card.value}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {card.label}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DashboardPanel({
  dashboard,
  structures,
}: {
  dashboard?: FeeDashboard;
  structures: FeeStructure[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel title="Finance Dashboard" icon={BarChart3}>
        <div className="grid gap-3 md:grid-cols-3">
          <InsightCard
            label="Total Demanded"
            value={money(dashboard?.kpis.totalDemanded)}
            detail="published and draft demands"
          />
          <InsightCard
            label="Total Collected"
            value={money(dashboard?.kpis.totalCollected)}
            detail="cash, online, bank and mixed modes"
          />
          <InsightCard
            label="Concessions"
            value={money(dashboard?.kpis.concessions)}
            detail="scholarship, waiver and discount approvals"
          />
        </div>
        <div className="mt-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
          <p className="text-sm font-semibold">Collection Trend</p>
          <div className="mt-3 flex h-28 items-end gap-2">
            {(dashboard?.trends?.length ? dashboard.trends : [{ month: 'Now', collected: 0 }]).map(
              (point) => (
                <div key={point.month} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-xl bg-primary/70"
                    style={{
                      height: `${Math.max(12, Math.min(100, Number(point.collected) / 1000))}%`,
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">{point.month}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </Panel>
      <Panel title="Active Structures" icon={Layers3}>
        <div className="space-y-2">
          {structures.slice(0, 6).map((structure) => (
            <div
              key={structure.id}
              className="rounded-2xl border border-border/70 bg-background/70 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{structure.name}</p>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                  {structure.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {structure.code} · {structure.billingFrequency}
              </p>
            </div>
          ))}
          {!structures.length && <EmptyState text="No fee structures configured yet." />}
        </div>
      </Panel>
    </div>
  );
}

function StructureStudio({ form, setForm, structures, onCreate, onPublish }: any) {
  return (
    <Panel title="Fee Structure Studio" icon={BookOpenCheck}>
      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <p className="font-semibold">Create fee structure</p>
          <div className="mt-3 grid gap-3">
            {(
              [
                'code',
                'name',
                'category',
                'billingFrequency',
                'componentCode',
                'componentName',
              ] as const
            ).map((key) => (
              <Input
                key={key}
                label={labelize(key)}
                value={form[key]}
                onChange={(value) => setForm((prev: any) => ({ ...prev, [key]: value }))}
              />
            ))}
            <Input
              label="Component Amount"
              type="number"
              value={form.componentAmount}
              onChange={(value) =>
                setForm((prev: any) => ({ ...prev, componentAmount: Number(value) }))
              }
            />
            <Button onClick={onCreate}>Save Draft Structure</Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {structures.map((structure: FeeStructure) => (
            <div
              key={structure.id}
              className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{structure.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {structure.code} · v{structure.version}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold">
                  {structure.status}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {(structure.components ?? []).slice(0, 4).map((component) => (
                  <div key={component.code} className="flex justify-between gap-2">
                    <span>{component.name}</span>
                    <span>{money(component.amount)}</span>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => onPublish(structure.id)}
              >
                Publish
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function DemandGenerator({ mode, scope, setScope, preview, loading, onPreview, onGenerate }: any) {
  return (
    <Panel
      title={mode === 'renewals' ? 'Renewal Center' : 'Demand Generator'}
      icon={mode === 'renewals' ? RefreshCw : FileText}
    >
      <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <p className="font-semibold">Generation scope</p>
          <div className="mt-3 grid gap-3">
            <Input
              label="Student ID (optional)"
              value={scope.studentId ?? ''}
              onChange={(value) =>
                setScope((prev: FeeDemandScope) => ({ ...prev, studentId: value || undefined }))
              }
            />
            <Input
              label="Programme Version ID"
              value={scope.programVersionId ?? ''}
              onChange={(value) =>
                setScope((prev: FeeDemandScope) => ({
                  ...prev,
                  programVersionId: value || undefined,
                }))
              }
            />
            <Input
              label="Shift ID"
              value={scope.shiftId ?? ''}
              onChange={(value) =>
                setScope((prev: FeeDemandScope) => ({ ...prev, shiftId: value || undefined }))
              }
            />
            <Input
              label="Semester Number"
              type="number"
              value={scope.semesterNumber ?? 1}
              onChange={(value) =>
                setScope((prev: FeeDemandScope) => ({ ...prev, semesterNumber: Number(value) }))
              }
            />
            <Input
              label="Billing Layer"
              value={mode === 'renewals' ? 'YEARLY' : (scope.billingLayer ?? 'YEARLY')}
              onChange={(value) =>
                setScope((prev: FeeDemandScope) => ({ ...prev, billingLayer: value }))
              }
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={onPreview} disabled={loading}>
                Preview
              </Button>
              <Button onClick={onGenerate} disabled={loading}>
                Generate
              </Button>
            </div>
          </div>
        </div>
        <PreviewTable preview={preview} />
      </div>
    </Panel>
  );
}

function PreviewTable({ preview }: { preview?: FeeDemandPreview }) {
  if (!preview)
    return (
      <EmptyState text="Run preview to simulate charges, duplicates, and subject-driven fees." />
    );
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 p-3 text-sm">
        <span>
          {preview.studentCount} students · {preview.duplicateCount} duplicates
        </span>
        <strong>{money(preview.totalAmount)}</strong>
      </div>
      <div className="max-h-[520px] overflow-auto">
        {preview.rows.map((row) => (
          <div key={row.studentId} className="border-b border-border/50 p-3 last:border-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{row.studentName}</p>
                <p className="text-xs text-muted-foreground">{row.enrollmentNumber}</p>
              </div>
              <span className="font-semibold">{money(row.totalAmount)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.lines.map((line) => (
                <span
                  key={`${row.studentId}-${line.code}`}
                  className="rounded-full border border-border bg-background px-2 py-1 text-[11px]"
                >
                  {line.name}: {money(line.amount)}
                </span>
              ))}
              {row.duplicateDemand && (
                <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700">
                  duplicate blocked
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CollectionConsole({ form, setForm, loading, onCollect, onOnline }: any) {
  return (
    <Panel title="Collection Console" icon={CreditCard}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Input
          label="Student ID"
          value={form.studentId}
          onChange={(value) => setForm((prev: any) => ({ ...prev, studentId: value }))}
        />
        <Input
          label="Amount"
          type="number"
          value={form.amount}
          onChange={(value) => setForm((prev: any) => ({ ...prev, amount: Number(value) }))}
        />
        <Input
          label="Payment Mode"
          value={form.paymentMode}
          onChange={(value) => setForm((prev: any) => ({ ...prev, paymentMode: value }))}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onCollect} disabled={loading || !form.studentId || !form.amount}>
          Collect & Receipt
        </Button>
        <Button
          variant="outline"
          onClick={onOnline}
          disabled={loading || !form.studentId || !form.amount}
        >
          Initiate Online Payment
        </Button>
      </div>
    </Panel>
  );
}

function LedgerExplorer({
  studentId,
  setStudentId,
  ledger,
  studentPortal,
}: {
  studentId: string;
  setStudentId: (value: string) => void;
  ledger?: StudentFeeLedger;
  studentPortal: boolean;
}) {
  return (
    <Panel title={studentPortal ? 'My Ledger' : 'Student Ledger Explorer'} icon={ReceiptText}>
      {!studentPortal && (
        <div className="mb-4 flex max-w-xl gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Enter student UUID"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
            />
          </div>
        </div>
      )}
      {!ledger ? (
        <EmptyState
          text={
            studentPortal
              ? 'No ledger entries found yet.'
              : 'Search a student to view complete finance ledger.'
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <InsightCard
              label="Charges"
              value={money(ledger.summary.charges)}
              detail="all demand postings"
            />
            <InsightCard
              label="Credits"
              value={money(ledger.summary.credits)}
              detail="payments, waivers, refunds"
            />
            <InsightCard
              label="Closing Balance"
              value={money(ledger.summary.closingBalance)}
              detail="real-time ledger balance"
            />
          </div>
          <div className="rounded-2xl border border-border/70">
            {ledger.entries.slice(0, 12).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 border-b border-border/60 p-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{entry.entryType}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.description ?? entry.entryNo}
                  </p>
                </div>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    Number(entry.debitAmount) > 0 ? 'text-rose-600' : 'text-emerald-600',
                  )}
                >
                  {Number(entry.debitAmount) > 0
                    ? money(entry.debitAmount)
                    : money(entry.creditAmount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function ReportsPanel({
  type,
  dashboard,
  report,
}: {
  type: string;
  dashboard?: FeeDashboard;
  report: any;
}) {
  const rows = report?.rows ?? dashboard?.defaulters ?? [];
  return (
    <Panel
      title={type === 'defaulters' ? 'Defaulter Intelligence Dashboard' : 'Reports & Cash Book'}
      icon={type === 'defaulters' ? AlertTriangle : LineChart}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <InsightCard
          label="Report Total"
          value={money(report?.total ?? dashboard?.kpis.outstanding)}
          detail="current filtered value"
        />
        <InsightCard label="Rows" value={rows.length} detail="records in this view" />
        <InsightCard
          label="Risk Signal"
          value={type === 'defaulters' ? 'High' : 'Normal'}
          detail="based on outstanding demand aging"
        />
      </div>
      <div className="mt-4 rounded-2xl border border-border/70">
        {rows.slice(0, 15).map((row: any) => (
          <div
            key={row.id ?? row.demandNo ?? row.transactionNo}
            className="flex items-center justify-between border-b border-border/60 p-3 text-sm last:border-0"
          >
            <span>{row.demandNo ?? row.transactionNo ?? row.studentId}</span>
            <strong>{money(row.balanceAmount ?? row.amount ?? 0)}</strong>
          </div>
        ))}
        {!rows.length && <EmptyState text="No report rows available yet." />}
      </div>
    </Panel>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/70 bg-card/90 p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function InsightCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/75 p-4">
      <p className="text-xl font-semibold">{value}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function StatusMessage({
  message,
  error,
  onClear,
}: {
  message: string;
  error: string;
  onClear: () => void;
}) {
  if (!message && !error) return null;
  return (
    <button
      type="button"
      onClick={onClear}
      className={cn(
        'w-full rounded-2xl border p-3 text-left text-sm',
        error
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-700'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
      )}
    >
      {error || message}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function money(value?: number | string | null) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN')}`;
}

function labelize(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}
