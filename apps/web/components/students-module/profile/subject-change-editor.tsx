'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Field, inputClass } from '@/components/student-profile/student-profile-shell';
import { ShiftTransferConfirmDialog } from '@/components/students-module/profile/shift-transfer-confirm-dialog';
import {
  fetchStudentRegistrationContext,
  updateAdminRegistrationLines,
} from '@/services/admin-registration';
import { fetchCatalog, fetchShifts, setStudentProgramChoice } from '@/services/academic-engine';
import { executeShiftTransfer, previewShiftTransfer } from '@/services/roll-number';
import {
  fetchSem1ImportCurriculum,
  fetchSem2ImportCurriculum,
  fetchSem3ImportCurriculum,
  fetchSem5ImportCurriculum,
} from '@/services/students';
import type { StudentProfile } from '@/types/students';
import type { CatalogSectionRow, CatalogWithEligibility } from '@/types/academic-engine';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type PaperRef = { code: string; title: string; offeringId?: string };
type ElectiveCategory = 'MDC' | 'AEC' | 'SEC' | 'VAC' | 'VTC' | 'INTERNSHIP';

const KEEP = '__KEEP__';

function catalogSections(
  result?: CatalogSectionRow[] | CatalogWithEligibility,
): CatalogSectionRow[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return [
    ...(result.eligible ?? []),
    ...((result.ineligible ?? []).map((item) => item.section) ?? []),
  ];
}

function normalizeCategory(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function normalizeLabel(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function departmentFromCourseCode(code?: string | null) {
  const prefix = String(code ?? '')
    .split(/[-:]/)[0]
    ?.trim()
    .toUpperCase();
  const map: Record<string, string> = {
    ECO: 'Economics',
    EDU: 'Education',
    ENG: 'English',
    GAR: 'Garo',
    GEO: 'Geography',
    HIS: 'History',
    PHI: 'Philosophy',
    POL: 'Political Science',
    SOC: 'Sociology',
    COM: 'Commerce',
    BCOM: 'Commerce',
  };
  return prefix ? map[prefix] : undefined;
}

function electiveCategoriesForSemester(semester: number): ElectiveCategory[] {
  if (semester <= 2) return ['MDC', 'AEC', 'SEC', 'VAC'];
  if (semester === 3) return ['MDC', 'AEC', 'SEC', 'VTC'];
  if (semester === 4) return ['VTC'];
  if (semester === 5) return ['INTERNSHIP'];
  return [];
}

function majorDepartmentEditable(semester: number) {
  return semester <= 2;
}

function categoryLabel(category: string) {
  if (category === 'VTC') return 'VTC';
  if (category === 'VAC') return 'VAC';
  if (category === 'INTERNSHIP') return 'Internship';
  return category;
}

function paperLabel(paper: PaperRef) {
  return `${paper.code} — ${paper.title}`;
}

function slugifySubjectLabel(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type RegistrationLine = {
  category?: string | null;
  offeringId?: string | null;
  offeringSectionId?: string | null;
  offering?: { course?: { code?: string; title?: string } | null } | null;
};

export function SubjectChangeEditor({ profile }: { profile: StudentProfile }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [shiftId, setShiftId] = useState('');
  const [majorDepartment, setMajorDepartment] = useState('');
  const [minorDepartment, setMinorDepartment] = useState('');
  const [keepExistingElectives, setKeepExistingElectives] = useState(true);
  const [electives, setElectives] = useState<Record<string, string>>({});
  const [auditReason, setAuditReason] = useState('');
  const [message, setMessage] = useState('');
  const [confirmTransferOpen, setConfirmTransferOpen] = useState(false);
  /** Transitional: staff enter roll from Excel instead of auto-allocation. */
  const [rollMode, setRollMode] = useState<'manual' | 'auto'>('manual');
  const [manualRollNumber, setManualRollNumber] = useState('');

  const context = useQuery({
    queryKey: ['admin-registrations', 'context', profile.id, 'subject-change'],
    queryFn: () => fetchStudentRegistrationContext(profile.id),
    enabled: open,
  });

  const semesterSequence = context.data?.semesterSequence ?? profile.semester ?? 1;
  const programVersionId = context.data?.student.programVersionId ?? profile.programVersionId ?? '';
  const programmeName = context.data?.student.programCode ?? profile.programme ?? 'Programme';
  const registration = context.data?.registration;
  const registrationEditable = registration?.status === 'draft';
  /** Admins may change electives (MDC/AEC/SEC/VTC) even after submit. */
  const electivesEditable = Boolean(registration);
  const currentPrimaryShiftId =
    context.data?.student.primaryShiftId ?? profile.primaryShiftId ?? '';
  const shiftChanging = Boolean(shiftId && shiftId !== currentPrimaryShiftId);
  const majorLocked = !majorDepartmentEditable(semesterSequence);
  const electiveCategories = useMemo(
    () => electiveCategoriesForSemester(semesterSequence),
    [semesterSequence],
  );

  const shifts = useQuery({
    queryKey: ['academic-engine', 'shifts', 'subject-change'],
    queryFn: fetchShifts,
    enabled: open,
  });

  const shiftPreviewQ = useQuery({
    queryKey: ['students', profile.id, 'shift-transfer-preview', shiftId],
    queryFn: () => previewShiftTransfer(profile.id, shiftId),
    enabled: open && shiftChanging && Boolean(shiftId) && rollMode === 'auto',
  });

  const manualRollTrimmed = manualRollNumber.trim().toUpperCase();
  const usingManualRoll = shiftChanging && rollMode === 'manual';
  const manualRollReady = Boolean(manualRollTrimmed);

  const curriculumQ = useQuery({
    queryKey: ['subject-change-curriculum', semesterSequence, programVersionId, shiftId],
    queryFn: async () => {
      if (!programVersionId) return null;
      if (semesterSequence <= 1) {
        return fetchSem1ImportCurriculum({ programVersionId, semesterSequence: 1 });
      }
      if (semesterSequence === 2) {
        return fetchSem2ImportCurriculum({
          programVersionId,
          shiftId: shiftId || undefined,
        });
      }
      if (semesterSequence === 3 || semesterSequence === 4) {
        return fetchSem3ImportCurriculum({
          programVersionId,
          semesterSequence: 3,
          shiftId: shiftId || undefined,
        });
      }
      return fetchSem5ImportCurriculum({
        programVersionId,
        semesterSequence: 5,
      });
    },
    enabled: open && Boolean(programVersionId),
  });

  const catalogQ = useQuery({
    queryKey: ['subject-change-catalog', profile.id, programVersionId, semesterSequence, shiftId],
    queryFn: () =>
      fetchCatalog({
        programVersionId,
        semesterSequence,
        shiftId: shiftId || undefined,
        studentId: profile.id,
        includeIneligible: true,
      }),
    enabled: open && Boolean(programVersionId),
  });

  const sections = catalogSections(catalogQ.data);

  const registrationLines = useMemo(
    () => (registration?.lines ?? []) as RegistrationLine[],
    [registration?.lines],
  );

  const currentMajorPapers = useMemo(() => {
    return registrationLines
      .filter((line) => normalizeCategory(line.category) === 'MAJOR')
      .map((line) => ({
        code: line.offering?.course?.code ?? '',
        title: line.offering?.course?.title ?? '',
      }))
      .filter((paper) => paper.code);
  }, [registrationLines]);

  const currentMajorDepartment = useMemo(() => {
    const choice = profile.programChoices?.find((c) => c.choiceType === 'MAJOR');
    return choice?.subjectName ?? departmentFromCourseCode(currentMajorPapers[0]?.code) ?? '—';
  }, [profile.programChoices, currentMajorPapers]);

  const currentMinorDepartment = useMemo(() => {
    const choice = profile.programChoices?.find((c) => c.choiceType === 'MINOR');
    return choice?.subjectName ?? '—';
  }, [profile.programChoices]);

  const currentElectives = useMemo(() => {
    const map = new Map<string, PaperRef[]>();
    for (const line of registrationLines) {
      const category = normalizeCategory(line.category);
      if (!electiveCategories.includes(category as ElectiveCategory)) continue;
      const code = line.offering?.course?.code;
      const title = line.offering?.course?.title;
      if (!code) continue;
      const list = map.get(category) ?? [];
      list.push({ code, title: title ?? code });
      map.set(category, list);
    }
    return map;
  }, [electiveCategories, registrationLines]);

  const majorDepartments = useMemo(() => {
    const curriculum = curriculumQ.data as
      | {
          majorDepartments?: Array<{
            departmentName: string;
            papers?: PaperRef[];
            paper?: PaperRef;
            paper1?: PaperRef;
            paper2?: PaperRef;
            paper3?: PaperRef;
            internship?: PaperRef;
          }>;
        }
      | null
      | undefined;
    return (curriculum?.majorDepartments ?? []).map((department) => {
      const papers: PaperRef[] =
        department.papers ??
        [department.paper1, department.paper2, department.paper3, department.paper].filter(
          (paper): paper is PaperRef => Boolean(paper),
        );
      return {
        departmentName: department.departmentName,
        papers,
        internship: department.internship,
      };
    });
  }, [curriculumQ.data]);

  const selectedMajor = useMemo(
    () =>
      majorDepartments.find(
        (department) =>
          normalizeLabel(department.departmentName) === normalizeLabel(majorDepartment),
      ) ??
      majorDepartments.find(
        (department) =>
          normalizeLabel(department.departmentName) === normalizeLabel(currentMajorDepartment),
      ),
    [majorDepartments, majorDepartment, currentMajorDepartment],
  );

  const previewMajorPapers = selectedMajor?.papers?.length
    ? selectedMajor.papers
    : currentMajorPapers;

  const electiveOptions = useMemo(() => {
    const curriculum = curriculumQ.data as Record<string, unknown> | null | undefined;
    const map = new Map<string, PaperRef[]>();
    const assign = (category: ElectiveCategory, papers?: PaperRef[]) => {
      if (papers?.length) map.set(category, papers);
    };
    if (!curriculum) return map;
    if (semesterSequence <= 1) {
      assign('MDC', curriculum.mdcDepartments as PaperRef[]);
      assign('AEC', curriculum.aecPapers as PaperRef[]);
      assign('SEC', curriculum.secPapers as PaperRef[]);
      if (curriculum.vacPaper) assign('VAC', [curriculum.vacPaper as PaperRef]);
    } else if (semesterSequence === 2) {
      assign('MDC', curriculum.mdcPapers as PaperRef[]);
      assign('AEC', curriculum.aecPapers as PaperRef[]);
      assign('SEC', curriculum.secPapers as PaperRef[]);
      assign('VAC', curriculum.vacPapers as PaperRef[]);
    } else if (semesterSequence === 3 || semesterSequence === 4) {
      assign('MDC', curriculum.mdcPapers as PaperRef[]);
      assign('AEC', curriculum.aecPapers as PaperRef[]);
      assign('SEC', curriculum.secPapers as PaperRef[]);
      assign('VTC', curriculum.vtcPapers as PaperRef[]);
    } else if (semesterSequence === 5 && selectedMajor?.internship) {
      assign('INTERNSHIP', [selectedMajor.internship]);
    }
    return map;
  }, [curriculumQ.data, semesterSequence, selectedMajor]);

  const minorOptions = useMemo(() => {
    const curriculum = curriculumQ.data as
      | { minorByMajor?: Record<string, string[]> }
      | null
      | undefined;
    if (!curriculum?.minorByMajor) return [] as string[];
    const key =
      Object.keys(curriculum.minorByMajor).find(
        (name) =>
          normalizeLabel(name) === normalizeLabel(majorDepartment || currentMajorDepartment),
      ) ?? '';
    return curriculum.minorByMajor[key] ?? [];
  }, [curriculumQ.data, majorDepartment, currentMajorDepartment]);

  useEffect(() => {
    if (!open) return;
    setShiftId(context.data?.student.primaryShiftId ?? profile.primaryShiftId ?? '');
    setMajorDepartment(currentMajorDepartment === '—' ? '' : currentMajorDepartment);
    setMinorDepartment(currentMinorDepartment === '—' ? '' : currentMinorDepartment);
    setKeepExistingElectives(true);
    setElectives({});
    setMessage('');
    setRollMode('manual');
    setManualRollNumber('');
  }, [
    open,
    context.data?.student.primaryShiftId,
    profile.primaryShiftId,
    currentMajorDepartment,
    currentMinorDepartment,
  ]);

  const resolveSectionForPaper = (paper: PaperRef, category: string) => {
    const preferredShift = shiftId || currentPrimaryShiftId;
    const matches = sections.filter((section) => {
      const course = section.courseOffering.course;
      const sectionCategory = normalizeCategory(section.courseOffering.category);
      if (sectionCategory && sectionCategory !== category) return false;
      if (paper.offeringId && section.courseOffering.id === paper.offeringId) return true;
      return normalizeLabel(course.code) === normalizeLabel(paper.code);
    });
    return matches.find((section) => section.shift?.id === preferredShift) ?? matches[0] ?? null;
  };

  const selectedElectivePreview = useMemo(() => {
    const map = new Map<string, PaperRef | 'KEEP'>();
    for (const category of electiveCategories) {
      if (keepExistingElectives) {
        map.set(category, 'KEEP');
        continue;
      }
      const value = electives[category] ?? KEEP;
      if (value === KEEP || !value) {
        map.set(category, 'KEEP');
        continue;
      }
      const options = electiveOptions.get(category) ?? [];
      const paper = options.find((item) => item.code === value);
      if (paper) map.set(category, paper);
    }
    return map;
  }, [electiveCategories, electives, electiveOptions, keepExistingElectives]);

  const changeSummary = useMemo(() => {
    const changed: string[] = [];
    const unchanged: string[] = ['Major Department', 'Major Papers'];
    if (shiftChanging) changed.push('Shift', 'Roll Number');
    else unchanged.push('Shift', 'Roll Number');
    if (
      majorDepartmentEditable(semesterSequence) &&
      majorDepartment &&
      normalizeLabel(majorDepartment) !== normalizeLabel(currentMajorDepartment)
    ) {
      changed.push('Major Department', 'Major Papers');
      unchanged.splice(unchanged.indexOf('Major Department'), 1);
      unchanged.splice(unchanged.indexOf('Major Papers'), 1);
    }
    if (
      majorDepartmentEditable(semesterSequence) &&
      minorDepartment &&
      normalizeLabel(minorDepartment) !== normalizeLabel(currentMinorDepartment)
    ) {
      changed.push('Minor Department');
    } else if (semesterSequence <= 2) {
      unchanged.push('Minor Department');
    }
    for (const category of electiveCategories) {
      const selected = selectedElectivePreview.get(category);
      if (selected === 'KEEP' || keepExistingElectives) unchanged.push(categoryLabel(category));
      else changed.push(categoryLabel(category));
    }
    return { changed: [...new Set(changed)], unchanged: [...new Set(unchanged)] };
  }, [
    shiftChanging,
    semesterSequence,
    majorDepartment,
    currentMajorDepartment,
    minorDepartment,
    currentMinorDepartment,
    electiveCategories,
    selectedElectivePreview,
    keepExistingElectives,
  ]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!registration?.id) {
        throw new Error(`No Semester ${semesterSequence} registration found for this student`);
      }

      let auditCount = 0;
      let shiftTransferResult: Awaited<ReturnType<typeof executeShiftTransfer>> | null = null;

      if (shiftChanging && shiftId) {
        if (rollMode === 'manual' && !manualRollTrimmed) {
          throw new Error('Enter the roll number from Excel for the destination shift.');
        }
        shiftTransferResult = await executeShiftTransfer(profile.id, {
          toShiftId: shiftId,
          reason: auditReason.trim() || 'Shift transfer',
          manualRollNumber: rollMode === 'manual' ? manualRollTrimmed : undefined,
        });
        auditCount += shiftTransferResult.auditRecorded ?? 0;
      }

      const onlyShiftTransfer =
        shiftChanging &&
        keepExistingElectives &&
        !(
          majorDepartmentEditable(semesterSequence) &&
          majorDepartment &&
          normalizeLabel(majorDepartment) !== normalizeLabel(currentMajorDepartment)
        ) &&
        !(
          majorDepartmentEditable(semesterSequence) &&
          minorDepartment &&
          normalizeLabel(minorDepartment) !== normalizeLabel(currentMinorDepartment)
        );

      if (onlyShiftTransfer) {
        return { auditCount, shiftTransferResult, onlyShiftTransfer: true as const };
      }

      if (!registration) {
        throw new Error('No semester registration found for this student.');
      }

      const preservedLines: Array<{
        category: string;
        offeringId?: string;
        offeringSectionId?: string;
      }> = [];
      const nextLines: Array<{
        category: string;
        offeringId?: string;
        offeringSectionId?: string;
      }> = [];

      // Major papers: auto-resolved from department (never picked individually).
      // On non-draft regs, keep existing majors unless draft editing of major is allowed.
      const majorPapers =
        registrationEditable &&
        majorDepartmentEditable(semesterSequence) &&
        selectedMajor?.papers?.length
          ? selectedMajor.papers
          : currentMajorPapers;

      for (const paper of majorPapers) {
        const section = resolveSectionForPaper(paper, 'MAJOR');
        if (!section) {
          throw new Error(`Could not resolve major paper ${paper.code} on the selected shift.`);
        }
        nextLines.push({
          category: 'MAJOR',
          offeringId: section.courseOffering.id,
          offeringSectionId: section.id,
        });
      }

      for (const line of registrationLines) {
        const category = normalizeCategory(line.category);
        if (category === 'MAJOR') continue;
        if (electiveCategories.includes(category as ElectiveCategory)) {
          if (keepExistingElectives || (electives[category] ?? KEEP) === KEEP) {
            preservedLines.push({
              category,
              offeringId: line.offeringId ?? undefined,
              offeringSectionId: line.offeringSectionId ?? undefined,
            });
          }
          continue;
        }
        preservedLines.push({
          category,
          offeringId: line.offeringId ?? undefined,
          offeringSectionId: line.offeringSectionId ?? undefined,
        });
      }

      if (!keepExistingElectives) {
        for (const category of electiveCategories) {
          const value = electives[category] ?? KEEP;
          if (value === KEEP || !value) continue;
          const options = electiveOptions.get(category) ?? [];
          const paper = options.find((item) => item.code === value);
          if (!paper) continue;
          const section = resolveSectionForPaper(paper, category);
          if (!section) {
            throw new Error(
              `Could not resolve ${category} paper ${paper.code} on the selected shift.`,
            );
          }
          nextLines.push({
            category,
            offeringId: section.courseOffering.id,
            offeringSectionId: section.id,
          });
        }
      }

      // When keeping electives after a shift transfer, backend already remapped sections.
      // Re-read is not needed; preserved lines still have old section IDs if transfer ran.
      // Prefer remapped lines from a fresh context when shift changed + keep electives.
      let linesToSave = [...nextLines, ...preservedLines];
      if (shiftChanging && keepExistingElectives) {
        const refreshed = await fetchStudentRegistrationContext(profile.id);
        const refreshedLines = (refreshed.registration?.lines ?? []) as RegistrationLine[];
        linesToSave = refreshedLines
          .filter((line) => line.offeringId)
          .map((line) => ({
            category: normalizeCategory(line.category),
            offeringId: line.offeringId ?? undefined,
            offeringSectionId: line.offeringSectionId ?? undefined,
          }));
        // Overlay major/elective changes if any (already handled by onlyShiftTransfer early return)
      }

      const regResult = await updateAdminRegistrationLines(registration.id, linesToSave, {
        auditReason: auditReason.trim() || undefined,
      });
      auditCount += regResult.auditRecorded ?? 0;

      if (majorDepartmentEditable(semesterSequence) && majorDepartment) {
        await setStudentProgramChoice(profile.id, {
          choiceType: 'MAJOR',
          subjectSlug: slugifySubjectLabel(majorDepartment),
        });
      }
      if (majorDepartmentEditable(semesterSequence) && minorDepartment) {
        await setStudentProgramChoice(profile.id, {
          choiceType: 'MINOR',
          subjectSlug: slugifySubjectLabel(minorDepartment),
        });
      }

      return { auditCount, shiftTransferResult, onlyShiftTransfer: false as const };
    },
    onSuccess: ({ auditCount, shiftTransferResult, onlyShiftTransfer }) => {
      const shiftNote = shiftTransferResult
        ? ` Shift: ${shiftTransferResult.oldShift.name} → ${shiftTransferResult.newShift.name}. Roll: ${shiftTransferResult.oldRollNumber ?? '—'} → ${shiftTransferResult.newRollNumber ?? '—'}.`
        : '';
      const preserveNote = onlyShiftTransfer
        ? ' All subjects were preserved on the new shift.'
        : '';
      const historyNote =
        auditCount > 0
          ? ` ${auditCount} academic change${auditCount === 1 ? '' : 's'} recorded.`
          : '';
      setMessage(`Saved successfully.${shiftNote}${preserveNote}${historyNote}`);
      setConfirmTransferOpen(false);
      void qc.invalidateQueries({ queryKey: ['students', profile.id] });
      void qc.invalidateQueries({ queryKey: ['admin-registrations', 'context', profile.id] });
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'profile', profile.id] });
    },
    onError: (error) => {
      setMessage(apiErrorMessage(error, 'Could not save subject / shift changes'));
    },
  });

  const currentShiftLabel =
    shifts.data?.find((shift) => shift.id === currentPrimaryShiftId)?.name ?? profile.shift ?? '—';
  const newShiftLabel = shifts.data?.find((shift) => shift.id === shiftId)?.name ?? '—';

  return (
    <div className="rounded-lg border border-border/70 bg-muted/15 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Semester {semesterSequence} subjects / shift</p>
          <p className="text-xs text-muted-foreground">
            Department-based major selection, live preview, and safe shift transfer.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide panel' : 'Change subjects / shift'}
        </Button>
      </div>

      {open ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            {/* Left panel */}
            <div className="space-y-3 rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Semester {roman(semesterSequence)} controls
              </p>

              {registration && !registrationEditable ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Registration status: <strong>{registration.status}</strong>. Electives (including
                  VTC) can still be changed by admin; major department stays locked for this
                  semester.
                </div>
              ) : null}

              <Field label="Programme">
                <input className={inputClass} disabled value={programmeName} />
              </Field>

              <Field label="Major Department">
                {majorLocked ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{currentMajorDepartment}</span>
                    <span className="text-xs text-muted-foreground">(fixed)</span>
                  </div>
                ) : (
                  <select
                    className={inputClass}
                    value={majorDepartment}
                    disabled={!registrationEditable || curriculumQ.isLoading}
                    onChange={(event) => {
                      setMajorDepartment(event.target.value);
                      setMinorDepartment('');
                    }}
                  >
                    <option value="">Select department</option>
                    {majorDepartments.map((department) => (
                      <option key={department.departmentName} value={department.departmentName}>
                        {department.departmentName}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              {semesterSequence <= 2 ? (
                <Field label="Minor Department">
                  <select
                    className={inputClass}
                    value={minorDepartment}
                    disabled={!registrationEditable || !majorDepartment}
                    onChange={(event) => setMinorDepartment(event.target.value)}
                  >
                    <option value="">Select minor department</option>
                    {minorOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              <Field label="Shift">
                <select
                  className={inputClass}
                  value={shiftId}
                  disabled={shifts.isLoading}
                  onChange={(event) => setShiftId(event.target.value)}
                >
                  {(shifts.data ?? []).map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.code} — {shift.name}
                    </option>
                  ))}
                </select>
              </Field>

              {shiftChanging ? (
                <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
                  <div>
                    <p className="font-medium">Shift transfer</p>
                    <p className="mt-1 text-muted-foreground">
                      {currentShiftLabel} → {newShiftLabel}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium">Roll number</p>
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="roll-mode"
                        className="mt-0.5"
                        checked={rollMode === 'manual'}
                        onChange={() => setRollMode('manual')}
                      />
                      <span>
                        <span className="font-medium">Enter from Excel</span>
                        <span className="block text-muted-foreground">
                          Recommended this year — use the roll staff already assigned in the sheet.
                        </span>
                      </span>
                    </label>
                    {rollMode === 'manual' ? (
                      <input
                        className={cn(inputClass, 'mt-1 font-mono')}
                        placeholder="e.g. BA25-731"
                        value={manualRollNumber}
                        onChange={(event) => setManualRollNumber(event.target.value.toUpperCase())}
                      />
                    ) : null}
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="roll-mode"
                        className="mt-0.5"
                        checked={rollMode === 'auto'}
                        onChange={() => setRollMode('auto')}
                      />
                      <span>
                        <span className="font-medium">Auto-generate</span>
                        <span className="block text-muted-foreground">
                          Uses destination shift roll ranges (for next academic year).
                        </span>
                      </span>
                    </label>
                  </div>

                  {rollMode === 'auto' ? (
                    shiftPreviewQ.isLoading ? (
                      <p className="text-muted-foreground">Calculating roll number…</p>
                    ) : shiftPreviewQ.isError ? (
                      <p className="text-destructive">
                        {apiErrorMessage(
                          shiftPreviewQ.error,
                          'Could not preview roll number. Use “Enter from Excel” instead.',
                        )}
                      </p>
                    ) : shiftPreviewQ.data ? (
                      <p>
                        Roll:{' '}
                        <span className="font-mono">
                          {shiftPreviewQ.data.currentRollNumber ?? '—'}
                        </span>
                        {' → '}
                        <span className="font-mono font-semibold text-primary">
                          {shiftPreviewQ.data.previewRollNumber}
                        </span>
                      </p>
                    ) : null
                  ) : manualRollReady ? (
                    <p>
                      Roll: <span className="font-mono">{profile.rollNumber ?? '—'}</span>
                      {' → '}
                      <span className="font-mono font-semibold text-primary">
                        {manualRollTrimmed}
                      </span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      Type the new roll exactly as in Excel (e.g. BA25-731).
                    </p>
                  )}

                  <p className="text-muted-foreground">
                    Major department and major papers stay the same. Only shift and roll number
                    change unless you edit electives below.
                  </p>
                </div>
              ) : null}

              <div className="rounded-md border border-border p-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={keepExistingElectives}
                    onChange={(event) => {
                      setKeepExistingElectives(event.target.checked);
                      if (event.target.checked) setElectives({});
                    }}
                  />
                  <span>
                    <span className="font-medium">Keep existing selections</span>
                    <span className="block text-xs text-muted-foreground">
                      Default. Leave electives unchanged (recommended for shift transfer).
                    </span>
                  </span>
                </label>
              </div>

              {!keepExistingElectives ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Subjects that may be changed
                  </p>
                  {electiveCategories.map((category) => {
                    const options = electiveOptions.get(category) ?? [];
                    return (
                      <Field key={category} label={categoryLabel(category)}>
                        <select
                          className={inputClass}
                          value={electives[category] ?? KEEP}
                          disabled={!electivesEditable || catalogQ.isLoading}
                          onChange={(event) =>
                            setElectives((current) => ({
                              ...current,
                              [category]: event.target.value,
                            }))
                          }
                        >
                          <option value={KEEP}>Keep existing</option>
                          {options.map((paper) => (
                            <option key={paper.code} value={paper.code}>
                              {paper.title}
                            </option>
                          ))}
                        </select>
                      </Field>
                    );
                  })}
                </div>
              ) : null}

              <Field label="Reason (optional)">
                <textarea
                  className={cn(inputClass, 'min-h-[60px] resize-y')}
                  placeholder="e.g. Student requested shift transfer"
                  value={auditReason}
                  onChange={(event) => setAuditReason(event.target.value)}
                />
              </Field>
            </div>

            {/* Right panel */}
            <div className="space-y-3 rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Live registration preview
              </p>

              <PreviewBlock title="Major Department">
                <p className="text-sm font-medium">
                  {majorDepartment || currentMajorDepartment}
                  {majorLocked ? (
                    <Lock className="ml-1 inline h-3.5 w-3.5 text-muted-foreground" />
                  ) : null}
                </p>
              </PreviewBlock>

              <PreviewBlock title="Major Papers">
                <ul className="space-y-1 text-sm">
                  {previewMajorPapers.map((paper) => (
                    <li key={paper.code} className="flex gap-2">
                      <span className="text-primary">✓</span>
                      <span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {paper.code}
                        </span>
                        {' — '}
                        {paper.title}
                      </span>
                    </li>
                  ))}
                  {previewMajorPapers.length === 0 ? (
                    <li className="text-muted-foreground">No major papers registered</li>
                  ) : null}
                </ul>
              </PreviewBlock>

              {electiveCategories.map((category) => {
                const current = currentElectives.get(category) ?? [];
                const selected = selectedElectivePreview.get(category);
                const changing = selected && selected !== 'KEEP';
                return (
                  <PreviewBlock key={category} title={categoryLabel(category)}>
                    {current.length ? (
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {current.map((paper) => (
                          <li key={paper.code}>{paperLabel(paper)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                    {changing ? (
                      <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 text-sm">
                        <p className="text-[11px] uppercase text-muted-foreground">Selected</p>
                        <p>{paperLabel(selected)}</p>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">Unchanged</p>
                    )}
                  </PreviewBlock>
                );
              })}

              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Summary of changes
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-foreground">Changed</p>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {changeSummary.changed.length ? (
                        changeSummary.changed.map((item) => <li key={item}>✓ {item}</li>)
                      ) : (
                        <li>None</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Not changed</p>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {changeSummary.unchanged.map((item) => (
                        <li key={item}>✓ {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={
                saveMut.isPending ||
                !registration?.id ||
                (shiftChanging && rollMode === 'manual' && !manualRollReady) ||
                (shiftChanging &&
                  rollMode === 'auto' &&
                  (shiftPreviewQ.isLoading || shiftPreviewQ.isError))
              }
              onClick={() => {
                if (shiftChanging) setConfirmTransferOpen(true);
                else saveMut.mutate();
              }}
            >
              {saveMut.isPending
                ? 'Saving…'
                : shiftChanging
                  ? 'Transfer shift (keep subjects)'
                  : 'Save changes'}
            </Button>
            <Link
              href={`/admin/students/subject-registration?student=${profile.id}`}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              Open subject registration
            </Link>
          </div>
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}

          <ShiftTransferConfirmDialog
            open={confirmTransferOpen}
            onOpenChange={setConfirmTransferOpen}
            preview={
              usingManualRoll && manualRollReady
                ? {
                    studentId: profile.id,
                    currentShift: {
                      id: currentPrimaryShiftId,
                      code: '',
                      name: currentShiftLabel,
                    },
                    targetShift: {
                      id: shiftId,
                      code: '',
                      name: newShiftLabel,
                    },
                    currentRollNumber: profile.rollNumber ?? null,
                    previewRollNumber: manualRollTrimmed,
                    admissionYear: 0,
                    prefix: '',
                  }
                : (shiftPreviewQ.data ?? null)
            }
            pending={saveMut.isPending}
            loading={!usingManualRoll && (shiftPreviewQ.isLoading || shiftPreviewQ.isFetching)}
            errorMessage={
              usingManualRoll
                ? manualRollReady
                  ? null
                  : 'Enter the roll number from Excel to continue.'
                : shiftPreviewQ.isError
                  ? apiErrorMessage(
                      shiftPreviewQ.error,
                      'Could not preview roll number. Switch to “Enter from Excel”.',
                    )
                  : null
            }
            onConfirm={() => saveMut.mutate()}
          />
        </div>
      ) : null}
    </div>
  );
}

function PreviewBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border/70 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function roman(value: number) {
  const map: Record<number, string> = {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
    5: 'V',
    6: 'VI',
  };
  return map[value] ?? String(value);
}
