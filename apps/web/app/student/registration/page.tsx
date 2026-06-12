'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { HonoursTrackSelector } from '@/components/students-module/subject-registration/honours-track-selector';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  createMyRegistration,
  fetchCatalog,
  fetchMyCreditSummary,
  fetchMyRegistration,
  fetchMyRegistrationWorkflow,
  fetchProgramStructure,
  fetchRegistrationWindows,
  fetchShifts,
  submitMyRegistration,
  updateMyRegistrationLines,
  validateMyRegistration,
} from '@/services/academic-engine';
import type { CatalogSectionRow } from '@/types/academic-engine';
import { ineligibleForCategory, normalizeCatalogResponse } from '@/utils/catalog-eligibility';
import {
  categorySlotKeys,
  formatSemesterSummary,
  requiredMajorPaperCount,
  slotCategory,
} from '@/utils/semester-rules';
import { electiveSlotBadge, filterVtcSectionsForTrack } from '@/utils/vtc-track-utils';
import { majorPaperOptionsForSlot } from '@/components/students-module/add-student/utils/subject-basket';
import { Class12EligibilityWarningBanner } from '@/components/students-module/subject-registration/class12-eligibility-warning-banner';
import { ALWAYS_AUTO_ASSIGNED_CATEGORIES } from '@/constants/nep-curriculum-categories';

type MeRegistrationData = Awaited<ReturnType<typeof fetchMyRegistration>>;

function seatLabel(s: CatalogSectionRow) {
  const used = s.seatLedger?.confirmedCount ?? 0;
  return `${used}/${s.capacity} seats`;
}

function catalogCourseId(row: CatalogSectionRow): string {
  const course = row.courseOffering.course as { id?: string; code: string };
  return course.id ?? course.code;
}

export default function StudentRegistrationPage() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const [semesterSequence, setSemesterSequence] = useState(1);
  const [shiftId, setShiftId] = useState('');
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<{ code: string; message: string }[]>([]);
  const [creditPreview, setCreditPreview] = useState<{
    draftTotal: number;
    draftByCategory: Record<string, number>;
  } | null>(null);

  const shifts = useQuery({
    queryKey: ['academic-engine', 'shifts'],
    queryFn: fetchShifts,
    enabled: Boolean(session),
  });

  const workflow = useQuery({
    queryKey: ['academic-engine', 'my-workflow'],
    queryFn: fetchMyRegistrationWorkflow,
    enabled: Boolean(session),
  });

  const windows = useQuery({
    queryKey: ['academic-engine', 'windows'],
    queryFn: fetchRegistrationWindows,
    enabled: Boolean(session),
  });

  const semesterId = useMemo(() => {
    const win = windows.data?.find((w) => w.semester.sequence === semesterSequence);
    return win?.semester.id;
  }, [windows.data, semesterSequence]);

  const me = useQuery({
    queryKey: ['academic-engine', 'me', semesterId],
    queryFn: () => fetchMyRegistration(semesterId),
    enabled: Boolean(session) && Boolean(semesterId),
  });

  const meData = me.data as MeRegistrationData | undefined;
  const currentSemesterSequence = meData?.standing?.currentSemesterSequence ?? semesterSequence;

  const programVersionId = me.data?.student.programVersionId ?? '';
  const activeShiftId = shiftId || shifts.data?.[0]?.id || '';

  const structure = useQuery({
    queryKey: ['academic-engine', 'structure', programVersionId],
    queryFn: () => fetchProgramStructure(programVersionId),
    enabled: Boolean(programVersionId),
  });

  const catalog = useQuery({
    queryKey: ['academic-engine', 'catalog', programVersionId, semesterSequence, activeShiftId],
    queryFn: () =>
      fetchCatalog({
        programVersionId,
        semesterSequence,
        shiftId: activeShiftId || undefined,
        includeIneligible: true,
      }),
    enabled: Boolean(programVersionId) && Boolean(activeShiftId),
  });

  const creditSummary = useQuery({
    queryKey: ['academic-engine', 'credit-summary'],
    queryFn: fetchMyCreditSummary,
    enabled: Boolean(session),
  });

  const rule = useMemo(
    () => structure.data?.rules.find((r) => r.semesterSequence === semesterSequence),
    [structure.data, semesterSequence],
  );

  const categories = useMemo(() => {
    if (!rule) return [];
    return categorySlotKeys(rule.categoryCounts);
  }, [rule]);

  const categoryCounts = rule?.categoryCounts ?? {};

  const electiveCategories = useMemo(() => {
    const fromWorkflow = workflow.data?.studentElectiveCategories;
    if (fromWorkflow?.length) return fromWorkflow;
    return Object.keys(categoryCounts).filter((cat) => !ALWAYS_AUTO_ASSIGNED_CATEGORIES.has(cat));
  }, [workflow.data, categoryCounts]);

  const compulsoryCategories = useMemo(
    () => Object.keys(categoryCounts).filter((c) => !electiveCategories.includes(c)),
    [categoryCounts, electiveCategories],
  );

  const studentChoiceCategories = useMemo(
    () => categories.filter((slotKey) => electiveCategories.includes(slotCategory(slotKey))),
    [categories, electiveCategories],
  );

  const activeWindow = useMemo(
    () => windows.data?.find((w) => w.semester.sequence === semesterSequence),
    [windows.data, semesterSequence],
  );

  const windowStatus =
    activeWindow?.status ?? (activeWindow?.locked ? 'LOCKED' : activeWindow ? 'CLOSED' : undefined);

  const catalogPartition = useMemo(
    () => normalizeCatalogResponse(catalog.data ?? { eligible: [], ineligible: [] }),
    [catalog.data],
  );

  const sectionsByCategory = useMemo(() => {
    const map: Record<string, CatalogSectionRow[]> = {};
    for (const s of catalogPartition.eligible) {
      const cat = s.courseOffering.category ?? 'OTHER';
      if (!map[cat]) map[cat] = [];
      map[cat].push(s);
    }
    return map;
  }, [catalogPartition.eligible]);

  const vtcTrackGroupCode = meData?.vtcTrack?.trackGroupCode ?? null;
  const majorMinorLocked = meData?.majorMinorTrack?.isTrackLocked ?? false;

  const sectionsForCategory = (cat: string): CatalogSectionRow[] => {
    const base = sectionsByCategory[cat] ?? [];
    if (cat === 'VTC') {
      return filterVtcSectionsForTrack(base, semesterSequence, vtcTrackGroupCode);
    }
    return base;
  };

  const categoryBadge = (cat: string): string | undefined =>
    electiveSlotBadge(cat, semesterSequence, { vtcTrackGroupCode });

  const vtcCategoryLocked = (cat: string): boolean =>
    cat === 'VTC' && semesterSequence > 3 && sectionsForCategory(cat).length === 1;

  const sectionById = useMemo(() => {
    const map = new Map<string, CatalogSectionRow>();
    for (const s of catalogPartition.eligible) map.set(s.id, s);
    return map;
  }, [catalogPartition.eligible]);

  const buildLines = () => {
    const lines: { category: string; offeringSectionId: string; offeringId: string }[] = [];
    for (const [key, sectionId] of Object.entries(selections)) {
      if (!sectionId) continue;
      const section = sectionById.get(sectionId);
      if (!section) continue;
      const category = slotCategory(key);
      lines.push({
        category,
        offeringSectionId: sectionId,
        offeringId: section.courseOffering.id,
      });
    }
    return lines;
  };

  const validateMut = useMutation({
    mutationFn: async (regId: string) => validateMyRegistration(regId),
    onSuccess: (data) => {
      setValidationIssues(data.issues);
      setCreditPreview({
        draftTotal: data.creditSummary.draftTotal,
        draftByCategory: data.creditSummary.draftByCategory,
      });
    },
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!semesterId) throw new Error('No registration window for this semester');

      let regId = me.data?.registration?.id;
      if (!regId) {
        const created = await createMyRegistration({ semesterId, semesterSequence });
        regId = created.id;
      }

      await updateMyRegistrationLines(regId!, buildLines());
      return submitMyRegistration(regId!);
    },
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['academic-engine'] });
    },
    onError: (e: unknown) => {
      const err = e as {
        response?: { data?: { message?: string; issues?: { message: string }[] } };
      };
      const issues = err.response?.data?.issues;
      setError(
        issues?.map((i) => i.message).join('; ') ??
          (typeof err.response?.data?.message === 'string'
            ? err.response.data.message
            : 'Registration failed'),
      );
    },
  });

  useEffect(() => {
    if (shifts.data?.length && !shiftId) {
      setShiftId(shifts.data.find((s) => s.code === 'DAY')?.id ?? shifts.data[0]!.id);
    }
  }, [shifts.data, shiftId]);

  useEffect(() => {
    const seq = meData?.standing?.currentSemesterSequence;
    if (seq && seq !== semesterSequence) {
      setSemesterSequence(seq);
      setSelections({});
    }
  }, [meData?.standing?.currentSemesterSequence, semesterSequence]);

  useEffect(() => {
    if (me.data?.registration?.status === 'completed') {
      const sel: Record<string, string> = {};
      for (const line of me.data.registration.lines) {
        const key =
          line.category === 'MAJOR' && rule?.categoryCounts.MAJOR === 2
            ? `MAJOR-${me.data.registration.lines.filter((l) => l.category === 'MAJOR').indexOf(line) + 1}`
            : line.category;
        sel[key] = line.offeringSectionId ?? line.offeringId;
      }
      setSelections(sel);
    }
  }, [me.data, rule]);

  useEffect(() => {
    const runValidate = async () => {
      if (!semesterId || me.data?.registration?.status === 'completed') return;
      if (Object.values(selections).every((v) => !v)) return;

      let regId = me.data?.registration?.id;
      if (!regId) {
        const created = await createMyRegistration({ semesterId, semesterSequence });
        regId = created.id;
        void qc.invalidateQueries({ queryKey: ['academic-engine', 'me'] });
      }
      await updateMyRegistrationLines(regId, buildLines());
      validateMut.mutate(regId);
    };
    const t = setTimeout(() => void runValidate(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections, semesterId, activeShiftId]);

  const completed = me.data?.registration?.status === 'completed';
  const progressDone = studentChoiceCategories.filter((c) => {
    if (c === 'MAJOR' && (rule?.categoryCounts.MAJOR ?? 1) === 2) {
      return selections['MAJOR-1'] && selections['MAJOR-2'];
    }
    return Boolean(selections[c]);
  }).length;

  if (!session) return null;

  const adminOnly =
    workflow.data?.batchRegistrationMode === 'ADMIN_ONLY' ||
    workflow.data?.mode === 'ADMIN_ONLY' ||
    !workflow.data?.allowStudentSelfService;

  const batchAdminOnly = workflow.data?.batchRegistrationMode === 'ADMIN_ONLY';

  const registrationBlocked =
    Boolean(meData?.standing?.registrationLocked) ||
    windowStatus === 'LOCKED' ||
    windowStatus === 'CLOSED' ||
    !activeWindow;

  const class12SubjectsMissing = (meData?.class12Subjects?.length ?? 0) === 0;

  return (
    <DashboardShell role="student" title="Course registration">
      <div className="min-w-0 grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-4">
          {batchAdminOnly ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              Your admission batch is configured for administrator-managed registration only.
              Contact the academic office if your subjects have not been allocated yet.
            </p>
          ) : adminOnly ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              Subject registration is managed by your college administration. Contact the academic
              office if your subjects have not been allocated yet.
            </p>
          ) : null}
          {activeWindow ? (
            <p
              className={`rounded-md border px-3 py-2 text-sm ${
                windowStatus === 'OPEN'
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-border bg-muted/40'
              }`}
            >
              Registration window: {activeWindow.name} ·{' '}
              <strong>{windowStatus ?? 'UNKNOWN'}</strong>
              {registrationBlocked && windowStatus !== 'OPEN' ? ' — submission disabled' : ''}
            </p>
          ) : (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              No registration window is open for this semester. Submission is disabled until the
              college opens registration.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Registering for semester {currentSemesterSequence}
            {rule ? ` · ${formatSemesterSummary(rule)}` : ''}
            {meData?.standing?.registrationLocked ? ' (registration locked)' : ''}
          </p>

          {class12SubjectsMissing ? <Class12EligibilityWarningBanner variant="student" /> : null}

          {majorMinorLocked ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              <span className="font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                Track locked
              </span>
              <p className="mt-0.5 text-muted-foreground">
                Major/Minor track locked after Semester 1 promotion.
              </p>
            </div>
          ) : null}

          {vtcTrackGroupCode && semesterSequence > 3 ? (
            <p className="text-xs text-muted-foreground">
              VTC continuing track: {vtcTrackGroupCode}
            </p>
          ) : null}

          {!rule && programVersionId ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              No semester structure rule found for this programme. Contact administration.
            </p>
          ) : null}

          {me.data?.student?.id && semesterSequence >= 8 ? (
            <HonoursTrackSelector
              studentId={me.data.student.id}
              semesterSequence={semesterSequence}
            />
          ) : null}

          {!adminOnly ? (
            <>
              <div className="flex flex-wrap gap-2">
                {(shifts.data ?? []).map((s) => (
                  <Button
                    key={s.id}
                    size="sm"
                    variant={activeShiftId === s.id ? 'default' : 'outline'}
                    onClick={() => {
                      setShiftId(s.id);
                      setSelections({});
                    }}
                  >
                    {s.name}
                  </Button>
                ))}
              </div>

              {rule ? (
                <p className="text-xs text-muted-foreground">
                  Progress: {progressDone}/{studentChoiceCategories.length || categories.length}{' '}
                  elective slots
                </p>
              ) : null}

              {me.data?.registration?.lines?.length ? (
                <CompactCard>
                  <CompactCardHeader title="Compulsory subjects (assigned)" />
                  <CompactCardBody className="space-y-1 text-sm">
                    {me.data.registration.lines
                      .filter((l) => compulsoryCategories.includes(l.category))
                      .map((l) => (
                        <p key={l.id} className="text-muted-foreground">
                          {l.category}: {l.offering.course.code} — {l.offering.course.title}
                          {l.status ? ` (${l.status})` : ''}
                        </p>
                      ))}
                    {me.data.registration.lines.filter((l) =>
                      compulsoryCategories.includes(l.category),
                    ).length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No compulsory subjects assigned yet — contact administration or wait for
                        auto-assign.
                      </p>
                    ) : null}
                  </CompactCardBody>
                </CompactCard>
              ) : null}

              {studentChoiceCategories.map((cat) => {
                const count = rule?.categoryCounts[cat] ?? 1;
                const majorCount =
                  cat === 'MAJOR' ? requiredMajorPaperCount(rule?.categoryCounts ?? {}) : count;
                if (cat === 'MAJOR' && majorCount > 1) {
                  const majorSections = sectionsByCategory.MAJOR ?? [];
                  return (
                    <CompactCard key={cat}>
                      <CompactCardHeader title={`MAJOR (${majorCount} papers)`} />
                      <CompactCardBody className="grid gap-3 sm:grid-cols-2">
                        {Array.from({ length: majorCount }, (_, i) => i + 1).map((idx) => {
                          const usedCourseIds = new Set<string>();
                          for (let prior = 1; prior < idx; prior++) {
                            const priorSectionId = selections[`MAJOR-${prior}`];
                            const priorSection = majorSections.find((s) => s.id === priorSectionId);
                            if (priorSection) usedCourseIds.add(catalogCourseId(priorSection));
                          }
                          const slotOptions = majorPaperOptionsForSlot(
                            majorSections,
                            undefined,
                            '',
                            idx - 1,
                            majorCount,
                            usedCourseIds,
                          );
                          const selectedCourseId = selections[`MAJOR-${idx}`]
                            ? catalogCourseId(
                                majorSections.find((s) => s.id === selections[`MAJOR-${idx}`])!,
                              )
                            : null;
                          const options =
                            selectedCourseId &&
                            !slotOptions.some((s) => catalogCourseId(s) === selectedCourseId)
                              ? [
                                  ...slotOptions,
                                  majorSections.find((s) => s.id === selections[`MAJOR-${idx}`])!,
                                ]
                              : slotOptions;

                          return (
                            <select
                              key={idx}
                              className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
                              value={selections[`MAJOR-${idx}`] ?? ''}
                              disabled={completed}
                              onChange={(e) =>
                                setSelections((s) => ({ ...s, [`MAJOR-${idx}`]: e.target.value }))
                              }
                            >
                              <option value="">Paper {idx}…</option>
                              {options.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.courseOffering.course.code} — {s.courseOffering.course.title} (
                                  {seatLabel(s)})
                                  {s.mappingSource === 'SHARED_POOL' ? ' · pool' : ''}
                                </option>
                              ))}
                            </select>
                          );
                        })}
                      </CompactCardBody>
                    </CompactCard>
                  );
                }
                return (
                  <CompactCard key={cat}>
                    <CompactCardHeader title={cat} description={categoryBadge(cat)} />
                    <CompactCardBody>
                      <select
                        className="h-9 w-full max-w-full rounded-md border border-border bg-card px-2 text-sm"
                        value={selections[cat] ?? ''}
                        disabled={completed || vtcCategoryLocked(cat)}
                        onChange={(e) => setSelections((s) => ({ ...s, [cat]: e.target.value }))}
                      >
                        <option value="">Select {cat} section…</option>
                        {sectionsForCategory(cat).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.courseOffering.course.code} — {s.courseOffering.course.title} (
                            {seatLabel(s)}){s.mappingSource === 'SHARED_POOL' ? ' · pool' : ''}
                          </option>
                        ))}
                        {ineligibleForCategory(catalogPartition.ineligible, cat).map((row) => (
                          <option
                            key={row.section.id}
                            value={row.section.id}
                            disabled
                            title={row.reasons[0]}
                          >
                            {row.section.courseOffering.course.code} —{' '}
                            {row.section.courseOffering.course.title} — {row.reasons[0]}
                          </option>
                        ))}
                      </select>
                      {ineligibleForCategory(catalogPartition.ineligible, cat).length > 0 ? (
                        <ul className="mt-2 space-y-1 rounded border border-border/50 bg-muted/20 p-2 text-xs text-muted-foreground">
                          {ineligibleForCategory(catalogPartition.ineligible, cat).map((row) => (
                            <li key={row.section.id}>
                              <span className="font-medium text-foreground">
                                {row.section.courseOffering.course.code}
                              </span>
                              : {row.reasons[0]}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </CompactCardBody>
                  </CompactCard>
                );
              })}

              {validationIssues.length > 0 ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p className="font-medium">Validation</p>
                  <ul className="mt-1 list-inside list-disc text-xs">
                    {validationIssues.map((i) => (
                      <li key={i.code}>{i.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {error ? <p className="text-sm text-danger">{error}</p> : null}

              {completed ? (
                <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">Registration {me.data?.registration?.status}</p>
                  <ul className="mt-2 space-y-1">
                    {me.data!.registration!.lines.map((l) => (
                      <li key={l.id}>
                        {l.category}: {l.offering.course.code} — {l.status}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Button
                  disabled={
                    submitMut.isPending ||
                    !programVersionId ||
                    validationIssues.length > 0 ||
                    registrationBlocked
                  }
                  onClick={() => submitMut.mutate()}
                >
                  {submitMut.isPending ? 'Submitting…' : 'Submit registration'}
                </Button>
              )}
            </>
          ) : null}

          {adminOnly && completed ? (
            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Your allocated subjects</p>
              <ul className="mt-2 space-y-1">
                {me.data!.registration!.lines.map((l) => (
                  <li key={l.id}>
                    {l.category}: {l.offering.course.code} — {l.status}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="space-y-3">
          <CompactCard>
            <CompactCardHeader title="Credits" />
            <CompactCardBody className="space-y-2 text-sm">
              <p>
                Draft: <strong>{creditPreview?.draftTotal ?? '—'}</strong>
              </p>
              {creditPreview
                ? Object.entries(creditPreview.draftByCategory).map(([k, v]) => (
                    <p key={k} className="text-xs text-muted-foreground">
                      {k}: {v}
                    </p>
                  ))
                : null}
              <hr className="border-border" />
              <p className="text-xs text-muted-foreground">Earned (all semesters)</p>
              <p className="font-medium">{creditSummary.data?.total ?? 0} credits</p>
            </CompactCardBody>
          </CompactCard>
        </aside>
      </div>
    </DashboardShell>
  );
}
