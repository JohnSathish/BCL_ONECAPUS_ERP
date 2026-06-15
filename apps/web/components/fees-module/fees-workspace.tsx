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
  Loader2,
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
import { fetchStudents } from '@/services/students';
import type { FeeDashboard, FeeDemandPreview, FeeStructure, StudentFeeLedger } from '@/types/fees';
import type { StudentDirectoryRow } from '@/types/students';
import { StudentFeeCyclePanel } from '@/components/fees-module/student-fee-cycle-panel';
import { FeeDemandWorkflowPanel } from '@/components/fees-module/fee-demand-workflow-panel';
import { FeeReconciliationPanel } from '@/components/fees-module/fee-reconciliation-panel';
import { DemandScopeForm, PreviewSummary } from '@/components/fees-module/demand-scope-form';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
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

      {visiblePage === 'dashboard' && portal === 'admin' && <FeeDemandWorkflowPanel />}

      {(visiblePage === 'dashboard' || portal === 'accountant') && (
        <DashboardPanel dashboard={dashboardQ.data} structures={structuresQ.data ?? []} />
      )}

      {visiblePage === 'dashboard' && portal === 'admin' ? <FeeReconciliationPanel /> : null}

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
        <>
          <FeeDemandWorkflowPanel compact />
          <DemandGenerator
            mode={visiblePage}
            scope={demandScope}
            setScope={setDemandScope}
            preview={previewMut.data}
            loading={previewMut.isPending || generateMut.isPending}
            onPreview={() => previewMut.mutate(demandScope)}
            onGenerate={() =>
              generateMut.mutate({ ...demandScope, publish: demandScope.publish ?? false })
            }
          />
        </>
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

      {(visiblePage === 'ledger' || visiblePage === 'student') && portal === 'student' ? (
        <StudentFeeCyclePanel />
      ) : null}

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
      label: 'Admission Collected',
      value: money(kpis?.admissionCollection),
      icon: ReceiptText,
      tone: 'text-blue-600',
    },
    {
      label: 'Monthly Collected',
      value: money(kpis?.monthlyCollection),
      icon: BarChart3,
      tone: 'text-indigo-600',
    },
    {
      label: 'Outstanding',
      value: money(kpis?.outstanding),
      icon: AlertTriangle,
      tone: 'text-rose-600',
    },
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
  const admission = Number(dashboard?.split?.admission ?? dashboard?.kpis.admissionCollection ?? 0);
  const monthly = Number(dashboard?.split?.monthly ?? dashboard?.kpis.monthlyCollection ?? 0);
  const total = admission + monthly || 1;
  const admissionPct = Math.round((admission / total) * 100);
  const monthlyPct = 100 - admissionPct;

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
            label="Admission Outstanding"
            value={money(dashboard?.kpis.admissionOutstanding)}
            detail="biennial cycle dues"
          />
          <InsightCard
            label="Monthly Outstanding"
            value={money(dashboard?.kpis.monthlyOutstanding)}
            detail="tuition arrears"
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="text-sm font-semibold">Collection Trend</p>
            <div className="mt-3 flex h-28 items-end gap-2">
              {(dashboard?.trends?.length
                ? dashboard.trends
                : [{ month: 'Now', collected: 0 }]
              ).map((point) => (
                <div key={point.month} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-xl bg-primary/70"
                    style={{
                      height: `${Math.max(12, Math.min(100, Number(point.collected) / 1000))}%`,
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">{point.month}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="text-sm font-semibold">Admission vs Monthly</p>
            <div className="mt-4 flex h-8 overflow-hidden rounded-full">
              <div
                className="bg-blue-500"
                style={{ width: `${admissionPct}%` }}
                title={`Admission ${admissionPct}%`}
              />
              <div
                className="bg-indigo-400"
                style={{ width: `${monthlyPct}%` }}
                title={`Monthly ${monthlyPct}%`}
              />
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span>Admission {money(admission)}</span>
              <span>Monthly {money(monthly)}</span>
            </div>
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
      <p className="mb-4 text-sm text-muted-foreground">
        Matches <strong>published</strong> fee structures to each student in scope, adds
        subject/practical charges where configured, then creates ledger entries. For standard
        admission or monthly billing, use the workflow cards above instead.
      </p>
      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <p className="font-semibold">Generation scope</p>
          <div className="mt-3">
            <DemandScopeForm scope={scope} setScope={setScope} mode={mode} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={onPreview} disabled={loading}>
                Preview
              </Button>
              <Button onClick={onGenerate} disabled={loading}>
                {scope.publish ? 'Generate & Publish' : 'Generate (draft)'}
              </Button>
            </div>
          </div>
        </div>
        <div>
          <PreviewSummary preview={preview} />
          <PreviewTable preview={preview} />
        </div>
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
  const [query, setQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentDirectoryRow | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchHint, setSearchHint] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);

  const typeaheadQ = useQuery({
    queryKey: ['ledger-student-typeahead', debouncedQuery],
    queryFn: async () => {
      const res = await fetchStudents({ search: debouncedQuery.trim(), limit: 8 });
      return res.data;
    },
    enabled: !studentPortal && debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  const suggestions = typeaheadQ.data ?? [];
  const showSuggestions =
    searchFocused &&
    debouncedQuery.trim().length >= 2 &&
    (typeaheadQ.isFetching || typeaheadQ.isFetched);

  function selectStudent(row: StudentDirectoryRow) {
    setStudentId(row.id);
    setSelectedStudent(row);
    setQuery(row.fullName || row.enrollmentNumber || '');
    setSearchFocused(false);
    setSearchHint('');
  }

  async function runExplicitSearch() {
    const q = query.trim();
    if (!q) return;
    let rows = debouncedQuery.trim() === q ? suggestions : [];
    if (!rows.length) {
      const res = await fetchStudents({ search: q, limit: 8 });
      rows = res.data;
    }
    if (rows.length === 1) {
      selectStudent(rows[0]);
    } else if (!rows.length) {
      setStudentId('');
      setSelectedStudent(null);
      setSearchHint(
        'No student found. Try enrollment no, roll no, name, mobile, Aadhaar, or RFID.',
      );
    } else {
      setSearchFocused(true);
      setSearchHint('');
    }
  }

  return (
    <Panel title={studentPortal ? 'My Ledger' : 'Student Ledger Explorer'} icon={ReceiptText}>
      {!studentPortal && (
        <div className="relative z-30 mb-4 max-w-2xl">
          <p className="mb-2 text-xs text-muted-foreground">
            Enrollment no · Roll no · Application no · Name · Mobile · Aadhaar · RFID
          </p>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Search by name, enrollment no, roll no, mobile…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchFocused(true);
                  if (searchHint) setSearchHint('');
                  if (!e.target.value.trim()) {
                    setStudentId('');
                    setSelectedStudent(null);
                  }
                }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 180)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && query.trim()) void runExplicitSearch();
                  if (e.key === 'Escape') setSearchFocused(false);
                }}
                autoComplete="off"
              />
              {typeaheadQ.isFetching && debouncedQuery.trim().length >= 2 ? (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : null}

              {showSuggestions ? (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-card shadow-lg">
                  {typeaheadQ.isFetching && !suggestions.length ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>
                  ) : suggestions.length ? (
                    <>
                      <p className="sticky top-0 border-b bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
                        {suggestions.length} student{suggestions.length === 1 ? '' : 's'} found
                      </p>
                      {suggestions.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectStudent(row)}
                          className="flex w-full items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-muted/70"
                        >
                          <span>
                            <strong>{row.fullName}</strong>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {row.enrollmentNumber}
                              {row.rollNumber ? ` · Roll ${row.rollNumber}` : ''}
                              {row.mobileNumber ? ` · ${row.mobileNumber}` : ''}
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-xs text-muted-foreground">
                            {row.programme ?? '—'}
                            {row.shift ? ` · ${row.shift}` : ''}
                          </span>
                        </button>
                      ))}
                    </>
                  ) : (
                    <p className="px-3 py-3 text-sm text-muted-foreground">
                      No students match &ldquo;{debouncedQuery.trim()}&rdquo;
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              className="h-10 shrink-0"
              disabled={!query.trim() || typeaheadQ.isFetching}
              onClick={() => void runExplicitSearch()}
            >
              <Search className="mr-1.5 h-4 w-4" />
              Search
            </Button>
          </div>
          {searchHint ? <p className="mt-2 text-xs text-amber-700">{searchHint}</p> : null}
          {selectedStudent && studentId ? (
            <p className="mt-2 text-sm">
              Viewing ledger for <strong>{selectedStudent.fullName}</strong>
              {selectedStudent.enrollmentNumber ? ` · ${selectedStudent.enrollmentNumber}` : ''}
            </p>
          ) : null}
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
  const reportType = type === 'defaulters' ? 'defaulters' : 'outstanding';

  const downloadExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      const { exportFeeReport } = await import('@/services/fee-cycle');
      if (format === 'csv') {
        const res = (await exportFeeReport(reportType, 'csv')) as {
          content?: string;
          filename?: string;
        };
        const blob = new Blob([res.content ?? ''], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename ?? `${reportType}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const blob = (await exportFeeReport(reportType, format)) as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      window.alert(message);
    }
  };

  return (
    <Panel
      title={type === 'defaulters' ? 'Defaulter Intelligence Dashboard' : 'Reports & Cash Book'}
      icon={type === 'defaulters' ? AlertTriangle : LineChart}
    >
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => void downloadExport('csv')}>
          Export CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => void downloadExport('xlsx')}>
          Export Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => void downloadExport('pdf')}>
          Export PDF
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <InsightCard
          label="Report Total"
          value={money(report?.total ?? dashboard?.kpis.outstanding)}
          detail="current filtered value"
        />
        <InsightCard label="Rows" value={rows.length} detail="records in this view" />
        <InsightCard
          label="Fines accrued"
          value={money(dashboard?.kpis.fines)}
          detail="late fee charges"
        />
      </div>
      <div className="mt-4 rounded-2xl border border-border/70">
        {rows.slice(0, 15).map((row: any) => (
          <div
            key={row.id ?? row.demandNo ?? row.transactionNo}
            className="flex items-center justify-between border-b border-border/60 p-3 text-sm last:border-0"
          >
            <div>
              <p className="font-medium">{row.studentName ?? row.demandNo ?? row.transactionNo}</p>
              <p className="text-xs text-muted-foreground">
                {row.enrollmentNumber ?? row.studentId}
                {row.demandType ? ` · ${row.demandType}` : ''}
              </p>
            </div>
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
