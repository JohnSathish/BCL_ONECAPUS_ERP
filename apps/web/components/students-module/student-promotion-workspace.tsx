'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock3,
  GraduationCap,
  History,
  Lock,
  Search,
  Users,
} from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { canManageAcademicLifecycle } from '@/lib/can-manage-academic';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  applyPromotionRun,
  createPromotionRun,
  fetchAcademicStructure,
  fetchAdmissionBatches,
  fetchCycleDashboard,
  fetchPromotionLogs,
  previewPromotion,
  validatePromotion,
} from '@/services/academic-lifecycle';
import { fetchInstitutions } from '@/services/organization';
import type {
  PromotionLogRow,
  PromotionPreviewStudent,
  PromotionValidateResponse,
} from '@/types/academic-lifecycle';
import { apiErrorMessage } from '@/utils/api-error';
import { formatDisplayDateTime } from '@/utils/format-date';
import { cn } from '@/utils/cn';

type Cycle = 'ODD' | 'EVEN';
type Step = 1 | 2 | 3 | 4;
type ReviewTab = 'eligible' | 'blocked';

type Pair = { from: number; to: number };

const PAGE_SIZE = 20;

const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100';

function promotionPairs(cycle: Cycle, maxSemester: number): Pair[] {
  const source: Pair[] =
    cycle === 'ODD'
      ? [
          { from: 1, to: 2 },
          { from: 3, to: 4 },
          { from: 5, to: 6 },
        ]
      : [
          { from: 2, to: 3 },
          { from: 4, to: 5 },
        ];
  return source.filter((pair) => pair.from >= 1 && pair.to <= maxSemester);
}

function pairLabel(pair: Pair) {
  return `Semester ${pair.from} → Semester ${pair.to}`;
}

function logCounts(run: PromotionLogRow['run']) {
  const counts = run?.counts;
  if (!counts || typeof counts !== 'object') {
    return { eligible: 0, blocked: 0, total: 0 };
  }
  const detained = Number(counts.detained ?? 0);
  const failed = Number(counts.failed ?? 0);
  return {
    eligible: Number(counts.eligible ?? 0),
    blocked: detained + failed,
    total: Number(counts.total ?? 0),
  };
}

function actionLabel(action: string) {
  if (action === 'RUN_APPLIED') return 'Promoted';
  if (action === 'RUN_CREATED') return 'Preview saved';
  if (action === 'RUN_ROLLED_BACK') return 'Rolled back';
  return action.replace(/_/g, ' ');
}

function seedFromSemester(semester?: number): { cycle: Cycle; from: number } | null {
  if (semester === 1 || semester === 3 || semester === 5) return { cycle: 'ODD', from: semester };
  if (semester === 2 || semester === 4) return { cycle: 'EVEN', from: semester };
  return null;
}

export function StudentPromotionWorkspace({
  selectedStudentCount = 0,
  initialSemester,
  initialBatchId = '',
  initialShiftId = '',
}: {
  selectedStudentCount?: number;
  initialSemester?: number;
  initialBatchId?: string;
  initialShiftId?: string;
}) {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const canManage = canManageAcademicLifecycle(session);
  const seeded = seedFromSemester(initialSemester);

  const [institutionId, setInstitutionId] = useState('');
  const [cycle, setCycle] = useState<Cycle>(seeded?.cycle ?? 'ODD');
  const [cycleReady, setCycleReady] = useState(Boolean(seeded));
  const [fromSequence, setFromSequence] = useState(seeded?.from ?? 1);
  const [batchId, setBatchId] = useState(initialBatchId);
  const [shiftId] = useState(initialShiftId);
  const [step, setStep] = useState<Step>(1);
  const [reviewTab, setReviewTab] = useState<ReviewTab>('eligible');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [leaveElectives, setLeaveElectives] = useState(true);
  const [historyCycle, setHistoryCycle] = useState<'ALL' | Cycle>('ALL');
  const [message, setMessage] = useState('');
  const [appliedSummary, setAppliedSummary] = useState<{
    eligible: number;
    blocked: number;
    from: number;
    to: number;
  } | null>(null);

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (!institutionId && institutions.data?.[0]?.id) {
      setInstitutionId(institutions.data[0].id);
    }
  }, [institutionId, institutions.data]);

  const structure = useQuery({
    queryKey: ['academic-lifecycle', 'structure', institutionId],
    queryFn: () => fetchAcademicStructure(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });

  const dashboard = useQuery({
    queryKey: ['academic-lifecycle', 'dashboard', institutionId],
    queryFn: () => fetchCycleDashboard(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });

  const batches = useQuery({
    queryKey: ['academic-lifecycle', 'batches', institutionId],
    queryFn: () => fetchAdmissionBatches(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });

  const logs = useQuery({
    queryKey: ['academic-lifecycle', 'promotion-logs', institutionId],
    queryFn: () => fetchPromotionLogs(institutionId, 100),
    enabled: Boolean(session) && Boolean(institutionId),
  });

  const maxSemester = structure.data?.config.maxActiveSemesters ?? 6;
  const pairs = useMemo(() => promotionPairs(cycle, maxSemester), [cycle, maxSemester]);
  const activePair = pairs.find((pair) => pair.from === fromSequence) ?? pairs[0];
  const toSequence = activePair?.to ?? fromSequence + 1;

  useEffect(() => {
    if (cycleReady || !dashboard.data?.currentCycle) return;
    const current = dashboard.data.currentCycle.toUpperCase();
    if (current === 'ODD' || current === 'EVEN') setCycle(current);
    setCycleReady(true);
  }, [cycleReady, dashboard.data?.currentCycle]);

  useEffect(() => {
    if (!pairs.some((pair) => pair.from === fromSequence)) {
      setFromSequence(pairs[0]?.from ?? 1);
    }
  }, [pairs, fromSequence]);

  useEffect(() => {
    setLeaveElectives(toSequence >= 2 && toSequence <= 7);
  }, [toSequence]);

  const scope = {
    institutionId,
    fromSequence,
    toSequence,
    admissionBatchId: batchId || undefined,
    shiftId: shiftId || undefined,
  };

  const preview = useQuery({
    queryKey: ['student-promotion', 'preview', scope],
    queryFn: () => previewPromotion(scope),
    enabled: Boolean(session) && Boolean(institutionId) && previewEnabled && Boolean(activePair),
    retry: false,
  });

  const validation = useQuery({
    queryKey: ['student-promotion', 'validate', scope],
    queryFn: () => validatePromotion(scope),
    enabled:
      Boolean(session) &&
      Boolean(institutionId) &&
      previewEnabled &&
      step >= 3 &&
      Boolean(activePair),
    retry: false,
  });

  const batchOptions = useMemo(
    () =>
      (batches.data ?? []).filter(
        (batch) => batch.isActive && batch.currentSemester === fromSequence,
      ),
    [batches.data, fromSequence],
  );

  useEffect(() => {
    if (!batches.isSuccess) return;
    if (batchId && !batchOptions.some((batch) => batch.id === batchId)) {
      setBatchId('');
    }
  }, [batchId, batchOptions, batches.isSuccess]);

  const blockedStudents = useMemo(() => {
    const rows = [...(preview.data?.detained ?? []), ...(preview.data?.failed ?? [])];
    return rows;
  }, [preview.data]);

  const mappingBlocks = useMemo(() => {
    const report = validation.data as PromotionValidateResponse | undefined;
    if (!report || !preview.data) return [];
    const eligibleIds = new Set(preview.data.eligible.map((student) => student.studentId));
    return report.students.filter(
      (student) => eligibleIds.has(student.studentId) && !student.valid,
    );
  }, [preview.data, validation.data]);

  const reviewRows = reviewTab === 'eligible' ? (preview.data?.eligible ?? []) : blockedStudents;
  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return reviewRows;
    return reviewRows.filter((student) => {
      const haystack = [
        student.studentName,
        student.enrollmentNumber,
        student.email,
        student.departmentName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [reviewRows, search]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visibleRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = preview.data?.counts;
  const blockedCount = (counts?.detained ?? 0) + (counts?.failed ?? 0);
  const eligibleCount = counts?.eligible ?? 0;
  const sessionName =
    dashboard.data?.primarySession?.name ??
    structure.data?.years.find((year) => year.semesters.length)?.name;
  const activeCycle = dashboard.data?.currentCycle?.toUpperCase() === 'EVEN' ? 'EVEN' : 'ODD';

  function resetReview() {
    setPreviewEnabled(false);
    setStep(1);
    setAcknowledged(false);
    setReviewTab('eligible');
    setSearch('');
    setPage(1);
    setMessage('');
  }

  function startPreview(tab: ReviewTab = 'eligible') {
    setMessage('');
    setAcknowledged(false);
    setReviewTab(tab);
    setPreviewEnabled(true);
    setStep(2);
    setPage(1);
  }

  const applyMut = useMutation({
    mutationFn: async () => {
      setAppliedSummary({
        eligible: eligibleCount,
        blocked: blockedCount,
        from: fromSequence,
        to: toSequence,
      });
      const run = (await createPromotionRun({
        ...scope,
        trigger: 'MANUAL',
        leaveElectivesForStudentRenewal: leaveElectives,
      })) as { id: string };
      return applyPromotionRun(run.id);
    },
    onSuccess: async () => {
      setStep(4);
      setAcknowledged(false);
      setMessage('');
      await qc.invalidateQueries({
        queryKey: ['academic-lifecycle', 'promotion-logs', institutionId],
      });
      await qc.invalidateQueries({ queryKey: ['student-promotion'] });
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Promotion was not applied')),
  });

  const lastPromotedCount = useMemo(() => {
    const row = (logs.data ?? []).find(
      (entry) =>
        entry.action === 'RUN_APPLIED' &&
        entry.run?.status === 'APPLIED' &&
        entry.run.fromSequence === fromSequence &&
        entry.run.toSemesterSequence === toSequence,
    );
    if (!row) return logs.isSuccess ? 0 : null;
    return logCounts(row.run).eligible;
  }, [fromSequence, logs.data, logs.isSuccess, toSequence]);

  const historyRows = useMemo(() => {
    return (logs.data ?? []).filter((row) => {
      const from = row.run?.fromSequence;
      if (!from || historyCycle === 'ALL') return true;
      return historyCycle === 'ODD' ? from % 2 === 1 : from % 2 === 0;
    });
  }, [historyCycle, logs.data]);

  const schedule = useMemo(() => {
    return [...promotionPairs('ODD', maxSemester), ...promotionPairs('EVEN', maxSemester)].map(
      (pair) => {
        const applied = (logs.data ?? []).find(
          (row) =>
            row.action === 'RUN_APPLIED' &&
            row.run?.fromSequence === pair.from &&
            row.run?.toSemesterSequence === pair.to &&
            row.run?.status === 'APPLIED',
        );
        return { pair, appliedAt: applied?.createdAt ?? null };
      },
    );
  }, [logs.data, maxSemester]);

  if (!session) return null;

  const canConfirm =
    canManage &&
    acknowledged &&
    eligibleCount > 0 &&
    !applyMut.isPending &&
    !validation.isLoading &&
    !validation.isError &&
    mappingBlocks.length === 0;

  return (
    <div className="space-y-4">
      {selectedStudentCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
          <p>
            <span className="font-semibold">{selectedStudentCount} students</span> were selected in
            the directory. Promotion here runs for every eligible student in the chosen semester and
            batch.
          </p>
          <Link
            href="/admin/students"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Back to directory
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
            {sessionName ? `AY ${sessionName}` : 'Academic year'}
          </span>
          <span
            className={cn(
              'rounded-full px-3 py-1 font-semibold',
              activeCycle === 'ODD' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800',
            )}
          >
            {activeCycle} cycle
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            document.getElementById('promotion-history')?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          <History className="mr-1.5 h-3.5 w-3.5" />
          History
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 px-5 py-5 text-white shadow-sm sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-white/80">
              SEMESTER PROMOTION
            </p>
            <h2 className="mt-1 text-2xl font-semibold">Student Promotion Management</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/85">
              Review eligible and blocked students, then confirm. Preview does not change academic
              records.
            </p>
          </div>
          <GraduationCap className="hidden h-14 w-14 text-white/80 sm:block" />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={Users}
          label="Total candidates"
          value={counts ? counts.total : null}
          tone="bg-sky-50 text-sky-700"
        />
        <StatCard
          icon={CheckCircle2}
          label="Eligible to promote"
          value={counts ? counts.eligible : null}
          tone="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          icon={Clock3}
          label="Blocked / on hold"
          value={counts ? blockedCount : null}
          tone="bg-amber-50 text-amber-700"
        />
        <StatCard
          icon={GraduationCap}
          label="Last promoted"
          value={step === 4 && appliedSummary ? appliedSummary.eligible : lastPromotedCount}
          tone="bg-violet-50 text-violet-700"
        />
        <StatCard
          icon={Ban}
          label="Not promoted"
          value={counts ? blockedCount : null}
          tone="bg-rose-50 text-rose-700"
        />
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Semester promotion</h3>
              <p className="text-sm text-slate-500">
                Four steps. Records change only after the confirmation step.
              </p>
            </div>
          </div>

          <ol className="mt-4 grid gap-2 sm:grid-cols-4">
            {[
              ['Select batch & semester', 1],
              ['Review students', 2],
              ['Confirm promotion', 3],
              ['Complete', 4],
            ].map(([label, number]) => {
              const index = number as Step;
              const reached = step === index;
              const done = step > index;
              return (
                <li key={label}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs',
                      reached
                        ? 'border-violet-300 bg-violet-50 text-violet-900'
                        : done
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 text-slate-500',
                    )}
                    onClick={() => {
                      if (index === 1) setStep(1);
                      if (index === 2 && preview.data) setStep(2);
                      if (index === 3 && preview.data && eligibleCount > 0) setStep(3);
                    }}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                        reached || done
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {index}
                    </span>
                    {label}
                  </button>
                </li>
              );
            })}
          </ol>

          {step === 1 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {institutions.data && institutions.data.length > 1 ? (
                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  Institution
                  <select
                    className={selectClass}
                    value={institutionId}
                    onChange={(event) => {
                      setInstitutionId(event.target.value);
                      resetReview();
                    }}
                  >
                    {institutions.data.map((institution) => (
                      <option key={institution.id} value={institution.id}>
                        {institution.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Academic year
                <input className={selectClass} value={sessionName ?? 'Loading…'} readOnly />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Cycle
                <select
                  className={selectClass}
                  value={cycle}
                  onChange={(event) => {
                    const next = event.target.value as Cycle;
                    const nextPairs = promotionPairs(next, maxSemester);
                    setCycle(next);
                    setFromSequence(nextPairs[0]?.from ?? 1);
                    setBatchId('');
                    resetReview();
                  }}
                >
                  <option value="ODD">Odd cycle · Semesters 1, 3 and 5</option>
                  <option value="EVEN">Even cycle · Semesters 2 and 4</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Current semester
                <select
                  className={selectClass}
                  value={activePair?.from ?? ''}
                  onChange={(event) => {
                    setFromSequence(Number(event.target.value));
                    setBatchId('');
                    resetReview();
                  }}
                >
                  {pairs.map((pair) => (
                    <option key={pair.from} value={pair.from}>
                      Semester {pair.from}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Promote to
                <input
                  className={selectClass}
                  value={activePair ? `Semester ${activePair.to}` : '—'}
                  readOnly
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700 md:col-span-2">
                Admission batch
                <select
                  className={selectClass}
                  value={batchId}
                  onChange={(event) => {
                    setBatchId(event.target.value);
                    resetReview();
                  }}
                >
                  <option value="">All students currently in this semester</option>
                  {batchOptions.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batchCode} · {batch._count?.studentProfiles ?? 0} profiles
                    </option>
                  ))}
                </select>
              </label>
              <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  {activePair
                    ? pairLabel(activePair)
                    : 'No promotion pair is available for this cycle.'}{' '}
                  Blocked students stay on the current semester.
                  {cycle === 'EVEN'
                    ? ' Semester 6 is the final semester and is not moved further.'
                    : ''}
                  {shiftId ? ' Limited to the shift selected in the directory.' : ''}
                </p>
                <Button
                  type="button"
                  onClick={startPreview}
                  disabled={!activePair || !institutionId}
                >
                  <Search className="mr-1.5 h-4 w-4" />
                  Preview students
                </Button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <FilterButton
                    active={reviewTab === 'eligible'}
                    onClick={() => {
                      setReviewTab('eligible');
                      setPage(1);
                    }}
                    label={`Eligible (${eligibleCount})`}
                  />
                  <FilterButton
                    active={reviewTab === 'blocked'}
                    onClick={() => {
                      setReviewTab('blocked');
                      setPage(1);
                    }}
                    label={`Blocked (${blockedCount})`}
                  />
                </div>
                <label className="relative block w-full max-w-xs text-sm">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    className={cn(selectClass, 'pl-9')}
                    placeholder="Search name or enrolment"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </label>
              </div>

              {preview.isLoading ? (
                <p className="text-sm text-slate-500">
                  Checking eligibility. No records are being changed.
                </p>
              ) : preview.isError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {apiErrorMessage(preview.error, 'Could not load the promotion preview')}
                </p>
              ) : (
                <StudentReviewTable
                  rows={visibleRows}
                  empty={
                    reviewTab === 'eligible' ? 'No eligible students.' : 'No blocked students.'
                  }
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Showing {visibleRows.length} of {filteredRows.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= pageCount}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={!preview.data || eligibleCount === 0 || preview.isFetching}
                  onClick={() => {
                    setAcknowledged(false);
                    setStep(3);
                  }}
                >
                  Continue to confirmation
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">This step updates student academic records.</p>
                <p className="mt-1">
                  {eligibleCount.toLocaleString()} eligible students move from Semester{' '}
                  {fromSequence} to Semester {toSequence}. {blockedCount.toLocaleString()} blocked
                  students stay where they are. A student who was already promoted for this
                  transition is rejected by the server.
                </p>
              </div>

              {validation.isLoading ? (
                <p className="text-sm text-slate-500">
                  Checking for duplicate promotions and subject mappings.
                </p>
              ) : validation.isError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {apiErrorMessage(
                    validation.error,
                    'Validation did not finish. Promotion stays blocked.',
                  )}
                </p>
              ) : mappingBlocks.length > 0 ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  <p className="font-semibold">
                    {mappingBlocks.length} eligible students cannot be promoted until these issues
                    are cleared.
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {mappingBlocks.slice(0, 8).map((student) => (
                      <li key={student.studentId}>
                        {student.studentName || student.enrollmentNumber || student.studentId}:{' '}
                        {student.messages.join('; ')}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-emerald-800">
                  Eligible students passed the duplicate and mapping checks.
                </p>
              )}

              <label className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={leaveElectives}
                  onChange={(event) => setLeaveElectives(event.target.checked)}
                />
                <span>
                  <span className="font-medium">Leave electives for student renewal</span>
                  <span className="mt-0.5 block text-slate-500">
                    Major and minor papers are filled. Students choose the remaining electives on
                    Subject renewal. Turn this off only when registrations should be completed
                    immediately.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-3 text-sm text-violet-950">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <span>
                  I have reviewed the eligible and blocked lists and want to apply this promotion.
                </span>
              </label>

              {!canManage ? (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Lock className="h-4 w-4" />
                  Your account can review promotion, but applying it needs academic lifecycle
                  permission.
                </p>
              ) : null}
              {message ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {message}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={applyMut.isPending}
                >
                  Back to review
                </Button>
                <Button type="button" disabled={!canConfirm} onClick={() => applyMut.mutate()}>
                  {applyMut.isPending ? 'Promoting…' : 'Confirm and promote'}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-950">
                <p className="text-base font-semibold">Promotion applied</p>
                <p className="mt-1 text-sm">
                  Semester {appliedSummary?.from ?? fromSequence} → Semester{' '}
                  {appliedSummary?.to ?? toSequence} is recorded.{' '}
                  {(appliedSummary?.eligible ?? eligibleCount).toLocaleString()} eligible students
                  were included. {(appliedSummary?.blocked ?? blockedCount).toLocaleString()}{' '}
                  blocked students were left unchanged. Running this transition again will not
                  promote the same students twice.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={resetReview}>
                  Promote another group
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById('promotion-history')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }
                >
                  View history
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Promotion schedule</h3>
            <ul className="mt-3 space-y-2">
              {schedule.map(({ pair, appliedAt }) => {
                const current = pair.from === fromSequence && pair.to === toSequence;
                return (
                  <li
                    key={`${pair.from}-${pair.to}`}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-sm',
                      current ? 'border-violet-200 bg-violet-50' : 'border-slate-100',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">{pairLabel(pair)}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          appliedAt
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800',
                        )}
                      >
                        {appliedAt ? 'Completed' : 'Not run'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {pair.from % 2 === 1 ? 'Odd cycle' : 'Even cycle'}
                      {appliedAt ? ` · ${formatDisplayDateTime(appliedAt)}` : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Quick actions</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => startPreview('eligible')}
              >
                Review eligible
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => startPreview('blocked')}
              >
                Review blocked
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-span-2"
                onClick={() =>
                  document
                    .getElementById('promotion-history')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
              >
                Promotion history
              </Button>
            </div>
            <Link
              href="/admin/academic-lifecycle"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mt-2 w-full')}
            >
              Open academic lifecycle
            </Link>
          </section>
        </aside>
      </div>

      <section
        id="promotion-history"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Promotion history</h3>
            <p className="text-sm text-slate-500">
              Every saved preview, applied run, and rollback for this college.
            </p>
          </div>
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            value={historyCycle}
            onChange={(event) => setHistoryCycle(event.target.value as 'ALL' | Cycle)}
          >
            <option value="ALL">All cycles</option>
            <option value="ODD">Odd cycle</option>
            <option value="EVEN">Even cycle</option>
          </select>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2 font-medium">When</th>
                <th className="px-2 py-2 font-medium">Academic year</th>
                <th className="px-2 py-2 font-medium">Cycle</th>
                <th className="px-2 py-2 font-medium">From → To</th>
                <th className="px-2 py-2 font-medium">Eligible</th>
                <th className="px-2 py-2 font-medium">Promoted</th>
                <th className="px-2 py-2 font-medium">Blocked</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Run by</th>
              </tr>
            </thead>
            <tbody>
              {logs.isLoading ? (
                <tr>
                  <td colSpan={9} className="px-2 py-8 text-center text-slate-500">
                    Loading promotion history…
                  </td>
                </tr>
              ) : historyRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-8 text-center text-slate-500">
                    No promotion activity yet. A confirmed run will appear here.
                  </td>
                </tr>
              ) : (
                historyRows.map((row) => {
                  const countsForRow = logCounts(row.run);
                  const promoted = row.action === 'RUN_APPLIED' ? countsForRow.eligible : 0;
                  const from = row.run?.fromSequence;
                  return (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-2 py-2 whitespace-nowrap">
                        {formatDisplayDateTime(row.createdAt)}
                      </td>
                      <td className="px-2 py-2">
                        {row.run?.admissionBatch?.entrySession?.name ?? '—'}
                      </td>
                      <td className="px-2 py-2">
                        {from ? (from % 2 === 1 ? 'Odd' : 'Even') : '—'}
                      </td>
                      <td className="px-2 py-2">
                        {row.run
                          ? `Sem ${row.run.fromSequence} → ${row.run.toSemesterSequence}`
                          : '—'}
                      </td>
                      <td className="px-2 py-2">{countsForRow.eligible}</td>
                      <td className="px-2 py-2">{promoted}</td>
                      <td className="px-2 py-2">{countsForRow.blocked}</td>
                      <td className="px-2 py-2">{actionLabel(row.action)}</td>
                      <td className="px-2 py-2">
                        {row.actor?.email ?? row.run?.appliedBy?.email ?? '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number | null;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-semibold text-slate-900">
          {value == null ? '—' : value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-sm font-medium',
        active ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600',
      )}
    >
      {label}
    </button>
  );
}

function StudentReviewTable({ rows, empty }: { rows: PromotionPreviewStudent[]; empty: string }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
        {empty}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Student</th>
            <th className="px-3 py-2 font-medium">Enrolment</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Department</th>
            <th className="px-3 py-2 font-medium">Result</th>
            <th className="px-3 py-2 font-medium">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((student) => (
            <tr key={student.studentId} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-900">
                {student.studentName || student.email || 'Student'}
              </td>
              <td className="px-3 py-2">{student.enrollmentNumber || '—'}</td>
              <td className="hidden px-3 py-2 md:table-cell">{student.departmentName || '—'}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    student.eligible
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800',
                  )}
                >
                  {student.eligible ? 'Eligible' : student.status}
                </span>
              </td>
              <td className="px-3 py-2 text-slate-600">
                {student.messages.length > 0
                  ? student.messages.join('; ')
                  : 'Ready for this transition'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
