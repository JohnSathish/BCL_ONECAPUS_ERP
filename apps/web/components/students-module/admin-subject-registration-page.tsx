'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { RegistrationImportDialog } from '@/components/academic-engine/registration-import-dialog';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { BulkGenerateRegistrationsDialog } from '@/components/students-module/subject-registration/bulk-generate-registrations-dialog';
import { ElectiveSlotPicker } from '@/components/students-module/subject-registration/elective-slot-picker';
import { EligibilityOverrideDialog } from '@/components/students-module/subject-registration/eligibility-override-dialog';
import { MigrationChecklistCard } from '@/components/students-module/subject-registration/migration-checklist-card';
import { AttendanceHandoffCard } from '@/components/students-module/subject-registration/attendance-handoff-card';
import {
  RegistrationScopeBar,
  type RegistrationScope,
} from '@/components/students-module/subject-registration/registration-scope-bar';
import { RegistrationWindowBanner } from '@/components/students-module/subject-registration/registration-window-banner';
import { RegistrationWorkflowPanel } from '@/components/students-module/subject-registration/registration-workflow-panel';
import { HonoursTrackSelector } from '@/components/students-module/subject-registration/honours-track-selector';
import { ValidationIssuesPanel } from '@/components/students-module/subject-registration/validation-issues-panel';
import { Class12EligibilityWarningBanner } from '@/components/students-module/subject-registration/class12-eligibility-warning-banner';
import { useRequireAuth } from '@/hooks/use-auth';
import { toShiftOptions } from '@/lib/shift-options';
import {
  fetchCatalog,
  fetchProgramStructure,
  fetchRegistrationWindows,
} from '@/services/academic-engine';
import { fetchAdmissionBatches } from '@/services/academic-lifecycle';
import { fetchDepartments, fetchCampuses, fetchInstitutions } from '@/services/organization';
import { fetchPrograms } from '@/services/programs';
import { fetchShifts } from '@/services/shifts';
import { fetchMigrationStatus } from '@/services/students';
import {
  autoAssignRegistration,
  createRegistrationForStudent,
  fetchAdminRegistrations,
  fetchStudentRegistrationContext,
  freezeRegistrations,
  submitAdminRegistration,
  updateAdminRegistrationLines,
  validateAdminRegistration,
} from '@/services/admin-registration';
import type { CatalogSectionRow } from '@/types/academic-engine';
import { apiErrorMessage } from '@/utils/api-error';
import { ineligibleForCategory, normalizeCatalogResponse } from '@/utils/catalog-eligibility';
import { ALWAYS_AUTO_ASSIGNED_CATEGORIES } from '@/constants/nep-curriculum-categories';
import { categorySlotKeys, slotCategory } from '@/utils/semester-rules';
import { electiveSlotBadge, filterVtcSectionsForTrack } from '@/utils/vtc-track-utils';

function isElectiveSlotKey(key: string, electiveCategories: string[]): boolean {
  return electiveCategories.includes(slotCategory(key));
}

export function AdminSubjectRegistrationPage() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [scope, setScope] = useState<RegistrationScope>({
    search: '',
    batchId: '',
    programVersionId: '',
    shiftId: '',
    statusFilter: '',
  });
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [overrideBySlot, setOverrideBySlot] = useState<
    Record<string, { sectionId: string; reason: string }>
  >({});
  const [pendingOverride, setPendingOverride] = useState<{
    slotKey: string;
    sectionId: string;
    reasons: string[];
    courseLabel?: string;
  } | null>(null);
  const [message, setMessage] = useState('');
  const [validationIssues, setValidationIssues] = useState<{ code: string; message: string }[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    const id = searchParams.get('student');
    if (id) setSelectedStudentId(id);
    const ids = searchParams.get('studentIds');
    if (ids) setStudentIds(ids.split(',').filter(Boolean));
    const pv = searchParams.get('programVersionId');
    const batch = searchParams.get('batchId');
    const shift = searchParams.get('shiftId');
    if (pv || batch || shift) {
      setScope((s) => ({
        ...s,
        programVersionId: pv ?? s.programVersionId,
        batchId: batch ?? s.batchId,
        shiftId: shift ?? s.shiftId,
      }));
    }
  }, [searchParams]);

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
  });
  const institutionId = institutions.data?.[0]?.id ?? '';

  const campuses = useQuery({
    queryKey: ['org', 'campuses', institutionId],
    queryFn: () => fetchCampuses(institutionId || undefined),
    enabled: Boolean(session) && Boolean(institutionId),
  });
  const campusId = campuses.data?.[0]?.id ?? '';

  const shifts = useQuery({
    queryKey: ['shifts', campusId, 'ACTIVE'],
    queryFn: () => fetchShifts({ campusId, status: 'ACTIVE' }),
    enabled: Boolean(session) && Boolean(campusId),
  });

  const windows = useQuery({
    queryKey: ['academic-engine', 'windows'],
    queryFn: fetchRegistrationWindows,
    enabled: Boolean(session),
  });

  const activeWindow = useMemo(() => {
    const open = (windows.data ?? []).find((w) => w.status === 'OPEN' || (!w.locked && !w.status));
    return open ?? windows.data?.[0];
  }, [windows.data]);

  const semesterId = activeWindow?.semester.id;
  const semesterSequence = activeWindow?.semester.sequence ?? 1;

  const batches = useQuery({
    queryKey: ['academic-lifecycle', 'batches', institutionId],
    queryFn: () => fetchAdmissionBatches(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });

  const batchCode = useMemo(() => {
    const batch = (batches.data ?? []).find((b) => b.id === scope.batchId);
    return batch?.batchCode ?? 'BATCH-2026';
  }, [batches.data, scope.batchId]);

  const migrationStatus = useQuery({
    queryKey: ['students', 'migration-status', batchCode, semesterSequence],
    queryFn: () => fetchMigrationStatus({ batchCode, semesterSequence }),
    enabled: Boolean(session),
    refetchInterval: 30_000,
  });

  const programs = useQuery({
    queryKey: ['catalog', 'programs'],
    queryFn: () => fetchPrograms(1),
    enabled: Boolean(session),
  });

  const programVersions = useMemo(() => {
    const rows: { id: string; label: string }[] = [];
    for (const p of programs.data?.data ?? []) {
      for (const v of p.versions ?? []) {
        rows.push({ id: v.id, label: `${p.code} v${v.version}` });
      }
    }
    return rows;
  }, [programs.data]);

  const list = useQuery({
    queryKey: [
      'admin-registrations',
      semesterId,
      scope.programVersionId,
      scope.batchId,
      scope.shiftId,
      scope.statusFilter,
      scope.search,
    ],
    queryFn: () =>
      fetchAdminRegistrations({
        semesterId,
        programVersionId: scope.programVersionId || undefined,
        admissionBatchId: scope.batchId || undefined,
        shiftId: scope.shiftId || undefined,
        status: scope.statusFilter || undefined,
        search: scope.search || undefined,
        limit: 50,
      }),
    enabled: Boolean(session) && Boolean(semesterId),
  });

  const context = useQuery({
    queryKey: ['admin-registrations', 'context', selectedStudentId, semesterId],
    queryFn: () => fetchStudentRegistrationContext(selectedStudentId, semesterId),
    enabled: Boolean(session) && Boolean(selectedStudentId) && Boolean(semesterId),
  });

  const pvId = context.data?.student.programVersionId ?? '';
  const shiftId = context.data?.student.primaryShiftId ?? '';

  const structure = useQuery({
    queryKey: ['academic-engine', 'structure', pvId],
    queryFn: () => fetchProgramStructure(pvId),
    enabled: Boolean(pvId),
  });

  const catalog = useQuery({
    queryKey: ['academic-engine', 'catalog', pvId, semesterSequence, shiftId, selectedStudentId],
    queryFn: () =>
      fetchCatalog({
        programVersionId: pvId,
        semesterSequence,
        shiftId: shiftId || undefined,
        studentId: selectedStudentId || undefined,
        includeIneligible: true,
      }),
    enabled: Boolean(pvId) && Boolean(shiftId),
  });

  const rule = useMemo(
    () => structure.data?.rules.find((r) => r.semesterSequence === semesterSequence),
    [structure.data, semesterSequence],
  );

  const electiveCategories =
    context.data?.workflow.studentElectiveCategories ??
    Object.keys(rule?.categoryCounts ?? {}).filter(
      (cat) => !ALWAYS_AUTO_ASSIGNED_CATEGORIES.has(cat),
    );

  const categoryFields = useMemo(() => (rule ? categorySlotKeys(rule.categoryCounts) : []), [rule]);

  const compulsoryFields = useMemo(
    () => categoryFields.filter((k) => !isElectiveSlotKey(k, electiveCategories)),
    [categoryFields, electiveCategories],
  );

  const electiveFields = useMemo(
    () => categoryFields.filter((k) => isElectiveSlotKey(k, electiveCategories)),
    [categoryFields, electiveCategories],
  );

  const catalogPartition = useMemo(
    () => normalizeCatalogResponse(catalog.data ?? { eligible: [], ineligible: [] }),
    [catalog.data],
  );

  const sectionsByCategory = useMemo(() => {
    const map: Record<string, CatalogSectionRow[]> = {};
    for (const s of catalogPartition.eligible) {
      const cat = s.courseOffering.category ?? 'OTHER';
      const idx = s.courseOffering.majorPaperIndex;
      const key =
        cat === 'MAJOR' && idx != null && (rule?.categoryCounts.MAJOR ?? 0) > 1
          ? `MAJOR-${idx}`
          : cat;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [catalogPartition.eligible, rule]);

  const trackSemester = context.data?.semesterSequence ?? semesterSequence;
  const vtcTrackGroupCode = context.data?.vtcTrack?.trackGroupCode ?? null;
  const majorMinorLocked = context.data?.majorMinorTrack?.isTrackLocked ?? false;
  const class12SubjectsMissing = (context.data?.class12Subjects?.length ?? 0) === 0;

  const sectionsForSlot = (key: string): CatalogSectionRow[] => {
    const base = sectionsByCategory[key] ?? sectionsByCategory[key.split('-')[0]!] ?? [];
    const category = slotCategory(key);
    if (category === 'VTC') {
      return filterVtcSectionsForTrack(base, trackSemester, vtcTrackGroupCode);
    }
    return base;
  };

  const slotBadge = (key: string): string | undefined => {
    const category = slotCategory(key);
    return electiveSlotBadge(category, trackSemester, { vtcTrackGroupCode });
  };

  const vtcSlotLocked = (key: string): boolean => {
    if (slotCategory(key) !== 'VTC') return false;
    if (trackSemester <= 3) return false;
    return sectionsForSlot(key).length === 1;
  };

  const sectionById = useMemo(() => {
    const map = new Map<string, CatalogSectionRow>();
    for (const s of catalogPartition.eligible) map.set(s.id, s);
    for (const row of catalogPartition.ineligible) map.set(row.section.id, row.section);
    return map;
  }, [catalogPartition]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-registrations'] });
    void qc.invalidateQueries({ queryKey: ['students', 'migration-status'] });
  };

  const buildLines = () => {
    const lines: {
      category: string;
      offeringSectionId: string;
      offeringId: string;
      eligibilityOverride?: boolean;
      eligibilityOverrideReason?: string;
    }[] = [];
    for (const [key, sectionId] of Object.entries(selections)) {
      if (!sectionId) continue;
      const section = sectionById.get(sectionId);
      if (!section) continue;
      const override = overrideBySlot[key];
      lines.push({
        category: key.startsWith('MAJOR') ? 'MAJOR' : key.split('-')[0]!,
        offeringSectionId: sectionId,
        offeringId: section.courseOffering.id,
        eligibilityOverride: override?.sectionId === sectionId,
        eligibilityOverrideReason: override?.sectionId === sectionId ? override.reason : undefined,
      });
    }
    if (reg?.lines?.length) {
      for (const line of reg.lines) {
        if (!line.offeringSectionId) continue;
        const already = lines.some((l) => l.offeringSectionId === line.offeringSectionId);
        if (!already && !electiveFields.some((k) => k.startsWith(line.category))) {
          lines.push({
            category: line.category,
            offeringSectionId: line.offeringSectionId,
            offeringId: line.offeringId,
          });
        }
      }
    }
    return lines;
  };

  const handleSlotChange = (slotKey: string, sectionId: string) => {
    setSelections((s) => ({ ...s, [slotKey]: sectionId }));
    setOverrideBySlot((prev) => {
      const next = { ...prev };
      if (next[slotKey]?.sectionId !== sectionId) delete next[slotKey];
      return next;
    });
  };

  const handleIneligiblePick = (slotKey: string, sectionId: string, reasons: string[]) => {
    const section = sectionById.get(sectionId);
    const courseLabel = section
      ? `${section.courseOffering.course.code} — ${section.courseOffering.course.title}`
      : undefined;
    setPendingOverride({ slotKey, sectionId, reasons, courseLabel });
  };

  useEffect(() => {
    const regLines = context.data?.registration?.lines;
    if (!regLines?.length) return;
    const nextOverrides: Record<string, { sectionId: string; reason: string }> = {};
    for (const line of regLines) {
      if (!line.eligibilityOverride || !line.offeringSectionId) continue;
      const key =
        line.category === 'MAJOR' && (rule?.categoryCounts.MAJOR ?? 0) > 1
          ? `MAJOR-${regLines.filter((l) => l.category === 'MAJOR').indexOf(line) + 1}`
          : line.category;
      nextOverrides[key] = {
        sectionId: line.offeringSectionId,
        reason: line.eligibilityOverrideReason ?? 'Eligibility overridden',
      };
    }
    setOverrideBySlot(nextOverrides);
  }, [context.data?.registration?.lines, rule?.categoryCounts.MAJOR]);

  const ensureRegMut = useMutation({
    mutationFn: async () => {
      if (!selectedStudentId || !semesterId || !context.data) {
        throw new Error('Select a student first');
      }
      if (context.data.registration) return context.data.registration;
      return createRegistrationForStudent(selectedStudentId, {
        semesterId,
        semesterSequence: context.data.semesterSequence,
      });
    },
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({
        queryKey: ['admin-registrations', 'context', selectedStudentId],
      });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not create registration')),
  });

  const saveLinesMut = useMutation({
    mutationFn: async () => {
      const regRow = context.data?.registration ?? (await ensureRegMut.mutateAsync());
      return updateAdminRegistrationLines(regRow.id, buildLines());
    },
    onSuccess: () => {
      setMessage('Subject allocation saved.');
      invalidate();
      void qc.invalidateQueries({
        queryKey: ['admin-registrations', 'context', selectedStudentId],
      });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Save failed')),
  });

  const validateMut = useMutation({
    mutationFn: async () => {
      const regRow = context.data?.registration;
      if (!regRow) throw new Error('No registration draft');
      return validateAdminRegistration(regRow.id);
    },
    onSuccess: (data) => {
      setValidationIssues(data.issues);
      setMessage(data.ok ? 'Validation passed.' : 'Validation found issues.');
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Validation failed')),
  });

  const autoAssignMut = useMutation({
    mutationFn: async () => {
      let regRow = context.data?.registration;
      if (!regRow) regRow = await ensureRegMut.mutateAsync();
      return autoAssignRegistration(regRow.id, 'COMPULSORY_ONLY');
    },
    onSuccess: () => {
      setMessage('Compulsory subjects auto-assigned.');
      invalidate();
      void qc.invalidateQueries({
        queryKey: ['admin-registrations', 'context', selectedStudentId],
      });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Auto-assign failed')),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      let regRow = context.data?.registration;
      if (!regRow) regRow = await ensureRegMut.mutateAsync();
      if (Object.keys(selections).length) {
        await updateAdminRegistrationLines(regRow.id, buildLines());
      }
      return submitAdminRegistration(regRow.id);
    },
    onSuccess: () => {
      setMessage('Registration submitted and seats allocated.');
      invalidate();
      void qc.invalidateQueries({
        queryKey: ['admin-registrations', 'context', selectedStudentId],
      });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Submit failed')),
  });

  const freezeMut = useMutation({
    mutationFn: (frozen: boolean) =>
      freezeRegistrations({
        frozen,
        admissionBatchId: scope.batchId || undefined,
        programVersionId: scope.programVersionId || undefined,
        studentIds: studentIds.length ? studentIds : undefined,
      }),
    onSuccess: (r) => {
      setMessage(
        r.frozen
          ? `Frozen registration for ${r.updated} students.`
          : `Unfrozen registration for ${r.updated} students.`,
      );
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Freeze update failed')),
  });

  if (!session) return null;

  const reg = context.data?.registration;
  const isDraft = !reg || reg.status === 'draft';
  const isCompleted = reg?.status === 'completed';

  const shiftOptions = toShiftOptions(shifts.data ?? []);

  return (
    <DashboardShell role="admin" title="Subject registration">
      <ErpWorkspace className="min-w-0 space-y-3">
        <RegistrationWindowBanner window={activeWindow} semesterSequence={semesterSequence} />

        <MigrationChecklistCard
          status={migrationStatus.data}
          loading={migrationStatus.isLoading}
          canGenerate={Boolean(semesterId)}
          canImport={Boolean(semesterId)}
          onGenerateRegistrations={() => setBulkOpen(true)}
          onImportSubjects={() => setImportOpen(true)}
        />

        <AttendanceHandoffCard status={migrationStatus.data} />

        {institutionId ? <RegistrationWorkflowPanel institutionId={institutionId} /> : null}

        {message ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{message}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={!semesterId} onClick={() => setBulkOpen(true)}>
            Generate registrations
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!semesterId}
            onClick={() => setImportOpen(true)}
          >
            Import Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={freezeMut.isPending}
            onClick={() => freezeMut.mutate(true)}
          >
            Freeze
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={freezeMut.isPending}
            onClick={() => freezeMut.mutate(false)}
          >
            Unfreeze
          </Button>
        </div>

        <RegistrationImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          semesterId={semesterId ?? ''}
          semesterSequence={semesterSequence}
        />

        <BulkGenerateRegistrationsDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          semesterId={semesterId ?? ''}
          semesterSequence={semesterSequence}
          programVersionId={scope.programVersionId || undefined}
          admissionBatchId={scope.batchId || undefined}
          shiftId={scope.shiftId || undefined}
          studentIds={studentIds}
          onComplete={() => invalidate()}
        />

        <CompactCard>
          <CompactCardHeader title="Scope" description="Filter students for registration queue" />
          <CompactCardBody>
            <RegistrationScopeBar
              scope={scope}
              onChange={(patch) => setScope((s) => ({ ...s, ...patch }))}
              batchOptions={(batches.data ?? []).map((b) => ({
                id: b.id,
                label: b.batchCode,
              }))}
              programOptions={programVersions}
              shiftOptions={shiftOptions}
            />
          </CompactCardBody>
        </CompactCard>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,24%)]">
          <CompactCard>
            <CompactCardHeader title="Student queue" />
            <CompactCardBody className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-2">Enrollment</th>
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Batch</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2">Locked</th>
                  </tr>
                </thead>
                <tbody>
                  {(list.data?.items ?? []).map((row) => (
                    <tr
                      key={row.studentId}
                      className={`cursor-pointer border-b border-border/60 hover:bg-muted/40 ${
                        selectedStudentId === row.studentId ? 'bg-muted/60' : ''
                      }`}
                      onClick={() => {
                        setSelectedStudentId(row.studentId);
                        setSelections({});
                        setOverrideBySlot({});
                        setValidationIssues([]);
                      }}
                    >
                      <td className="py-2 pr-2 font-mono text-xs">{row.enrollmentNumber}</td>
                      <td className="py-2 pr-2">{row.fullName}</td>
                      <td className="py-2 pr-2">{row.batchCode ?? '—'}</td>
                      <td className="py-2 pr-2">{row.registration?.status ?? 'none'}</td>
                      <td className="py-2">{row.registrationLocked ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CompactCardBody>
          </CompactCard>

          <CompactCard>
            <CompactCardHeader
              title={context.data?.student.fullName ?? 'Registration workspace'}
              description={
                context.data
                  ? `${context.data.student.enrollmentNumber} · Sem ${context.data.semesterSequence}`
                  : 'Select a student'
              }
            />
            <CompactCardBody className="space-y-4">
              {!selectedStudentId ? (
                <p className="text-sm text-muted-foreground">Select a student from the queue.</p>
              ) : context.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Workflow: {context.data?.workflow.mode}
                    {context.data?.standing?.registrationLocked ? ' · Locked' : ''}
                  </p>
                  {class12SubjectsMissing ? <Class12EligibilityWarningBanner /> : null}
                  {majorMinorLocked ? (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                      <span className="font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                        Track locked
                      </span>
                      <p className="mt-0.5 text-muted-foreground">
                        Major/Minor track locked after Semester 1 promotion.
                        {context.data?.majorMinorTrack?.majorSubject
                          ? ` Major: ${context.data.majorMinorTrack.majorSubject.name}.`
                          : ''}
                        {context.data?.majorMinorTrack?.minorSubject
                          ? ` Minor: ${context.data.majorMinorTrack.minorSubject.name}.`
                          : ''}
                      </p>
                    </div>
                  ) : null}
                  {context.data?.vtcTrack?.trackGroupCode && trackSemester > 3 ? (
                    <p className="text-xs text-muted-foreground">
                      VTC continuing track: {context.data.vtcTrack.trackGroupCode}
                    </p>
                  ) : null}
                  {context.data?.canChangeMajorMinor !== false ? (
                    <Link
                      href={`/admin/students/${selectedStudentId}/academic`}
                      className="text-xs text-primary underline"
                    >
                      Edit major/minor & stream
                    </Link>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Major/minor path editing disabled (track locked).
                    </p>
                  )}

                  {semesterSequence >= 8 ? (
                    <HonoursTrackSelector
                      studentId={selectedStudentId}
                      semesterSequence={semesterSequence}
                    />
                  ) : null}

                  {compulsoryFields.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Compulsory (auto-assigned)
                      </p>
                      {compulsoryFields.map((key) => (
                        <ElectiveSlotPicker
                          key={key}
                          slotKey={key}
                          label={key}
                          sections={sectionsForSlot(key)}
                          value={selections[key] ?? ''}
                          locked
                          badgeLabel={slotBadge(key) ?? 'Auto-assigned'}
                          disabled={!isDraft || isCompleted}
                          onChange={(v) => setSelections((s) => ({ ...s, [key]: v }))}
                        />
                      ))}
                      {reg?.lines
                        ?.filter((l) => compulsoryFields.some((k) => k.startsWith(l.category)))
                        .map((l) => (
                          <p key={l.id} className="text-xs text-muted-foreground">
                            {l.category}: {l.offering.course.code} (
                            {l.offeringSectionId ? 'assigned' : 'pending'})
                          </p>
                        ))}
                    </div>
                  ) : null}

                  {electiveFields.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Student choice
                      </p>
                      {electiveFields.map((key) => (
                        <ElectiveSlotPicker
                          key={key}
                          slotKey={key}
                          label={key}
                          sections={sectionsForSlot(key)}
                          ineligibleSections={ineligibleForCategory(
                            catalogPartition.ineligible,
                            slotCategory(key),
                          )}
                          value={selections[key] ?? ''}
                          badgeLabel={slotBadge(key)}
                          locked={vtcSlotLocked(key)}
                          disabled={!isDraft || isCompleted}
                          allowIneligiblePick={isDraft && !isCompleted}
                          overrideReason={
                            overrideBySlot[key]?.sectionId === selections[key]
                              ? overrideBySlot[key]?.reason
                              : undefined
                          }
                          onChange={(v) => handleSlotChange(key, v)}
                          onIneligiblePick={(sectionId, reasons) =>
                            handleIneligiblePick(key, sectionId, reasons)
                          }
                        />
                      ))}
                    </div>
                  ) : null}

                  <ValidationIssuesPanel issues={validationIssues} />

                  {isCompleted && reg ? (
                    <ul className="space-y-1 text-sm">
                      {reg.lines.map((l) => (
                        <li key={l.id} className="rounded border border-border px-2 py-1">
                          {l.category}: {l.offering.course.code} ({l.status})
                          {l.eligibilityOverride ? (
                            <span className="ml-1 text-xs text-amber-700 dark:text-amber-300">
                              · Eligibility overridden
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <EligibilityOverrideDialog
                    open={Boolean(pendingOverride)}
                    courseLabel={pendingOverride?.courseLabel}
                    reasons={pendingOverride?.reasons ?? []}
                    onCancel={() => setPendingOverride(null)}
                    onConfirm={(reason) => {
                      if (!pendingOverride) return;
                      setSelections((s) => ({
                        ...s,
                        [pendingOverride.slotKey]: pendingOverride.sectionId,
                      }));
                      setOverrideBySlot((prev) => ({
                        ...prev,
                        [pendingOverride.slotKey]: {
                          sectionId: pendingOverride.sectionId,
                          reason,
                        },
                      }));
                      setPendingOverride(null);
                    }}
                  />

                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={autoAssignMut.isPending || !isDraft}
                      onClick={() => autoAssignMut.mutate()}
                    >
                      Auto-assign compulsory
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saveLinesMut.isPending || !isDraft}
                      onClick={() => saveLinesMut.mutate()}
                    >
                      Save draft
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={validateMut.isPending || !reg}
                      onClick={() => validateMut.mutate()}
                    >
                      Validate
                    </Button>
                    <Button
                      size="sm"
                      disabled={submitMut.isPending || !isDraft}
                      onClick={() => submitMut.mutate()}
                    >
                      Submit & allocate
                    </Button>
                  </div>
                </>
              )}
            </CompactCardBody>
          </CompactCard>
        </div>
      </ErpWorkspace>
    </DashboardShell>
  );
}
