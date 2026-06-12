'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { AddStaffPageShell } from '@/components/staff-module/add-staff/add-staff-page-shell';
import { AddStaffStepper } from '@/components/staff-module/add-staff/add-staff-stepper';
import {
  AddStaffSummaryMobileBar,
  AddStaffSummaryPanel,
} from '@/components/staff-module/add-staff/add-staff-summary-panel';
import { WIZARD_STEPS } from '@/components/staff-module/add-staff/constants';
import { StepBasic } from '@/components/staff-module/add-staff/steps/step-basic';
import { StepDocuments } from '@/components/staff-module/add-staff/steps/step-documents';
import { StepEmployment } from '@/components/staff-module/add-staff/steps/step-employment';
import { StepPortal } from '@/components/staff-module/add-staff/steps/step-portal';
import { StepReview } from '@/components/staff-module/add-staff/steps/step-review';
import { StepSalary } from '@/components/staff-module/add-staff/steps/step-salary';
import { StepSubjects } from '@/components/staff-module/add-staff/steps/step-subjects';
import {
  createEmptyDraft,
  type AddStaffDraft,
} from '@/components/staff-module/add-staff/types/draft';
import {
  buildAddressSectionPayload,
  buildCreateStaffPayload,
  buildSalarySectionPayload,
} from '@/components/staff-module/add-staff/utils/build-create-staff-payload';
import {
  clearDraftStorage,
  hasRecoverableDraft,
  isPristineDraft,
  loadDraftFromStorage,
  mergeWithEmptyDraft,
  saveDraftToStorage,
} from '@/components/staff-module/add-staff/utils/draft-storage';
import {
  dataUrlToPhotoFile,
  isPersistablePhotoUrl,
} from '@/components/students-module/add-student/utils/photo-utils';
import {
  firstStepError,
  normalizeBasicDraftFields,
  validateStaffSubmit,
  validateStepFields,
} from '@/components/staff-module/add-staff/utils/validation';
import { DirectoryGlassCard } from '@/components/students-module/directory/ui/directory-glass-card';
import { ErpWorkspace, ErpWorkspaceGrid } from '@/components/erp/erp-workspace-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { toShiftOptions } from '@/lib/shift-options';
import { fetchDepartments, fetchCampuses, fetchInstitutions } from '@/services/organization';
import { fetchShifts } from '@/services/shifts';
import {
  assignSubject,
  createStaff,
  fetchAcademicRoles,
  updateStaffProfileSection,
  uploadStaffPhoto,
} from '@/services/staff';
import { fetchSupportDataRows } from '@/services/support-data';
import { previewEmployeeCode } from '@/services/employee-code';
import type { StaffProfile } from '@/types/staff';
import { apiErrorMessage } from '@/utils/api-error';

export function AddStaffWizard() {
  const session = useRequireAuth();
  const perms = useStaffPermissions();
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [draft, setDraft] = useState<AddStaffDraft>(() => createEmptyDraft());
  const [savedDraft, setSavedDraft] = useState<AddStaffDraft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState('');
  const [createdProfile, setCreatedProfile] = useState<StaffProfile | null>(null);
  const [savedLabel, setSavedLabel] = useState('');
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [employeeCodePreviewLoading, setEmployeeCodePreviewLoading] = useState(false);
  const completeRef = useRef(false);

  const debouncedDraft = useDebouncedValue(draft, 800);
  const step = WIZARD_STEPS[stepIndex];

  useEffect(() => {
    const saved = loadDraftFromStorage();
    if (hasRecoverableDraft(saved)) {
      setSavedDraft(saved);
    } else if (saved) {
      clearDraftStorage();
    }
  }, []);

  const markDraftSaved = useCallback((label = 'Saved just now') => {
    setSavedLabel(label);
  }, []);

  useEffect(() => {
    if (completeRef.current) return;
    if (savedDraft && isPristineDraft(debouncedDraft)) return;
    saveDraftToStorage(debouncedDraft);
    markDraftSaved();
  }, [debouncedDraft, savedDraft, markDraftSaved]);

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
  const campusId = campuses.data?.[0]?.id ?? draft.campusId;

  useEffect(() => {
    if (campusId && !draft.campusId) setDraft((d) => ({ ...d, campusId }));
  }, [campusId, draft.campusId]);

  const refreshEmployeeCodePreview = useCallback(async () => {
    if (!draft.employeeCodeAutoGenerated || draft.employeeCodeFinalized) {
      setDraft((d) => ({ ...d, employeeCodePreview: '', employeeCode: '' }));
      return;
    }
    if (!draft.staffType || !draft.joiningDate) {
      setDraft((d) => ({ ...d, employeeCodePreview: '', employeeCode: '' }));
      return;
    }
    setEmployeeCodePreviewLoading(true);
    try {
      const preview = await previewEmployeeCode({
        staffType: draft.staffType,
        joiningDate: draft.joiningDate,
        institutionId: institutionId || undefined,
      });
      setDraft((d) => ({
        ...d,
        employeeCodePreview: preview.employeeCode,
        employeeCode: preview.employeeCode,
        employeeCodeSourceStaffType: draft.staffType,
      }));
    } catch {
      setDraft((d) => ({ ...d, employeeCodePreview: '', employeeCode: '' }));
    } finally {
      setEmployeeCodePreviewLoading(false);
    }
  }, [
    draft.staffType,
    draft.joiningDate,
    draft.employeeCodeAutoGenerated,
    draft.employeeCodeFinalized,
    institutionId,
    setDraft,
  ]);

  useEffect(() => {
    if (!draft.employeeCodeAutoGenerated || draft.employeeCodeFinalized) return;
    if (!draft.staffType || !draft.joiningDate) {
      setDraft((d) =>
        d.employeeCodePreview || d.employeeCode
          ? { ...d, employeeCodePreview: '', employeeCode: '' }
          : d,
      );
      return;
    }
    const timer = window.setTimeout(() => {
      void refreshEmployeeCodePreview();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    draft.staffType,
    draft.joiningDate,
    draft.employeeCodeAutoGenerated,
    draft.employeeCodeFinalized,
    refreshEmployeeCodePreview,
    setDraft,
  ]);

  const departments = useQuery({
    queryKey: ['org', 'departments'],
    queryFn: () => fetchDepartments(),
    enabled: Boolean(session),
  });

  const designations = useQuery({
    queryKey: ['support-data', 'designations'],
    queryFn: () => fetchSupportDataRows('designations'),
    enabled: Boolean(session),
  });

  const academicRoles = useQuery({
    queryKey: ['staff', 'academic-roles'],
    queryFn: fetchAcademicRoles,
    enabled: Boolean(session),
  });

  const shifts = useQuery({
    queryKey: ['shifts', campusId, 'ACTIVE'],
    queryFn: () => fetchShifts({ campusId, status: 'ACTIVE' }),
    enabled: Boolean(session) && Boolean(campusId),
  });

  const departmentOptions = useMemo(
    () =>
      (departments.data ?? []).map((d) => ({
        id: d.id,
        label: d.name,
        departmentType: d.departmentType,
      })),
    [departments.data],
  );

  const designationOptions = useMemo(
    () =>
      (designations.data ?? []).map((d) => ({
        id: d.id,
        label: d.label,
        category: d.metadata?.category as string | undefined,
      })),
    [designations.data],
  );

  const academicRoleOptions = useMemo(
    () => (academicRoles.data ?? []).map((r) => ({ code: r.code, label: r.label })),
    [academicRoles.data],
  );

  const shiftOptions = useMemo(() => toShiftOptions(shifts.data ?? []), [shifts.data]);

  const departmentLabel = departmentOptions.find((d) => d.id === draft.departmentId)?.label;
  const designationLabel = designationOptions.find((d) => d.id === draft.designationId)?.label;
  const shiftLabel = shiftOptions.find((s) => s.id === draft.primaryShiftId)?.label;

  const createMut = useMutation({
    mutationFn: async (payload: AddStaffDraft) => {
      let profile = await createStaff(buildCreateStaffPayload(payload, institutionId || undefined));

      if (isPersistablePhotoUrl(payload.photoPreviewUrl)) {
        const file = await dataUrlToPhotoFile(payload.photoPreviewUrl, 'staff-photo.jpg');
        if (file) {
          const uploaded = await uploadStaffPhoto(profile.id, file);
          profile = { ...profile, photoUrl: uploaded.photoUrl };
        }
      }

      const addressPayload = buildAddressSectionPayload(payload);
      if (Object.values(addressPayload.addressJson).some(Boolean)) {
        await updateStaffProfileSection(profile.id, 'address', addressPayload);
      }

      const salaryPayload = buildSalarySectionPayload(payload);
      if (Object.values(salaryPayload).some((v) => v != null && v !== '')) {
        await updateStaffProfileSection(profile.id, 'salary', salaryPayload);
      }

      for (const assignment of payload.subjectAssignments) {
        await assignSubject(profile.id, {
          courseId: assignment.courseId,
          semesterNo: assignment.semesterNo,
          programVersionId: assignment.programVersionId,
          offeringSectionId: assignment.offeringSectionId,
          category: assignment.category ?? undefined,
          shiftId: assignment.shiftId || payload.primaryShiftId || undefined,
          isPrimaryFaculty: assignment.isPrimaryFaculty,
        });
      }

      return profile;
    },
    onSuccess: (profile) => {
      completeRef.current = true;
      clearDraftStorage();
      setCreatedProfile(profile);
      setBannerError('');
    },
    onError: (e) => setBannerError(apiErrorMessage(e, 'Failed to create staff')),
  });

  const goNext = () => {
    let nextDraft = draft;
    if (step.id === 'basic') {
      nextDraft = normalizeBasicDraftFields(draft);
      setDraft(nextDraft);
    }

    const errors = validateStepFields(step.id, nextDraft);
    setFieldErrors(errors);
    const first = firstStepError(errors);
    if (first) {
      setBannerError(first);
      return;
    }
    setBannerError('');
    setFieldErrors({});
    const next = Math.min(stepIndex + 1, WIZARD_STEPS.length - 1);
    setStepIndex(next);
    setMaxReached((m) => Math.max(m, next));
  };

  const goBack = () => {
    setBannerError('');
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const handleSubmit = () => {
    const normalizedDraft = normalizeBasicDraftFields(draft);
    setDraft(normalizedDraft);
    const issues = validateStaffSubmit(normalizedDraft);
    setValidationIssues(issues);
    if (issues.length) {
      setBannerError(issues[0] ?? 'Fix validation issues');
      setStepIndex(WIZARD_STEPS.length - 1);
      return;
    }
    createMut.mutate(normalizedDraft);
  };

  if (!session) return null;

  if (!perms.canManage) {
    return (
      <DashboardShell role="admin" title="Add Staff">
        <p className="text-sm text-muted-foreground">You do not have permission to add staff.</p>
      </DashboardShell>
    );
  }

  if (createdProfile) {
    return (
      <DashboardShell role="admin" title="Staff created">
        <DirectoryGlassCard className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Staff record created</h2>
          <p className="text-xs text-muted-foreground">
            {createdProfile.fullName} ({createdProfile.employeeCode}) has been added.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => router.push(`/admin/staff/${createdProfile.id}`)}
            >
              Open profile
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                completeRef.current = false;
                setCreatedProfile(null);
                setDraft(createEmptyDraft());
                setStepIndex(0);
                setMaxReached(0);
              }}
            >
              Add another
            </Button>
            <Link href="/admin/staff" className="text-xs text-primary hover:underline self-center">
              Back to directory
            </Link>
          </div>
        </DirectoryGlassCard>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="admin" title="Add Staff">
      <ErpWorkspace className="space-y-2">
        {savedDraft ? (
          <DirectoryGlassCard className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
            <span>You have a saved draft from a previous session.</span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  setDraft(mergeWithEmptyDraft(savedDraft));
                  setSavedDraft(null);
                }}
              >
                Resume draft
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  clearDraftStorage();
                  setSavedDraft(null);
                }}
              >
                Discard
              </Button>
            </div>
          </DirectoryGlassCard>
        ) : null}

        <AddStaffPageShell draft={draft} stepLabel={step.label} savedLabel={savedLabel}>
          <AddStaffStepper
            stepIndex={stepIndex}
            maxReached={maxReached}
            onStepClick={setStepIndex}
          />

          {bannerError ? (
            <p className="glass-card rounded-lg px-2.5 py-1.5 text-xs text-destructive">
              {bannerError}
            </p>
          ) : null}

          <ErpWorkspaceGrid
            main={
              <DirectoryGlassCard className="p-3">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    {step.id === 'basic' ? (
                      <StepBasic
                        draft={draft}
                        setDraft={setDraft}
                        errors={fieldErrors}
                        employeeCodePreviewLoading={employeeCodePreviewLoading}
                        onRefreshEmployeeCodePreview={refreshEmployeeCodePreview}
                      />
                    ) : null}
                    {step.id === 'employment' ? (
                      <StepEmployment
                        draft={draft}
                        setDraft={setDraft}
                        errors={fieldErrors}
                        departmentOptions={departmentOptions}
                        designationOptions={designationOptions}
                        academicRoleOptions={academicRoleOptions}
                        shiftOptions={shiftOptions}
                      />
                    ) : null}
                    {step.id === 'subjects' ? (
                      <StepSubjects draft={draft} setDraft={setDraft} />
                    ) : null}
                    {step.id === 'portal' ? (
                      <StepPortal draft={draft} setDraft={setDraft} errors={fieldErrors} />
                    ) : null}
                    {step.id === 'salary' ? <StepSalary draft={draft} setDraft={setDraft} /> : null}
                    {step.id === 'documents' ? (
                      <StepDocuments draft={draft} setDraft={setDraft} />
                    ) : null}
                    {step.id === 'review' ? (
                      <StepReview
                        draft={draft}
                        departmentLabel={departmentLabel}
                        designationLabel={designationLabel}
                        shiftLabel={shiftLabel}
                        validationIssues={validationIssues}
                      />
                    ) : null}
                  </motion.div>
                </AnimatePresence>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    disabled={stepIndex === 0}
                    onClick={goBack}
                  >
                    Back
                  </Button>
                  <div className="flex gap-2">
                    {stepIndex < WIZARD_STEPS.length - 1 ? (
                      <Button type="button" size="sm" className="h-8 text-xs" onClick={goNext}>
                        Continue
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={createMut.isPending}
                        onClick={handleSubmit}
                      >
                        {createMut.isPending ? 'Creating…' : 'Create staff'}
                      </Button>
                    )}
                  </div>
                </div>
              </DirectoryGlassCard>
            }
            sidebar={
              <AddStaffSummaryPanel
                draft={draft}
                departmentLabel={departmentLabel}
                shiftLabel={shiftLabel}
                validationIssues={validationIssues}
                className="hidden lg:block"
              />
            }
          />
        </AddStaffPageShell>

        <AddStaffSummaryMobileBar draft={draft} onOpen={() => setMobileSummaryOpen(true)} />

        {mobileSummaryOpen ? (
          <div className="fixed inset-0 z-50 bg-background/80 p-4 lg:hidden">
            <div className="relative mx-auto max-w-sm">
              <button
                type="button"
                className="absolute right-0 top-0 rounded-full p-1"
                onClick={() => setMobileSummaryOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
              <AddStaffSummaryPanel
                draft={draft}
                departmentLabel={departmentLabel}
                shiftLabel={shiftLabel}
                compact
              />
            </div>
          </div>
        ) : null}
      </ErpWorkspace>
    </DashboardShell>
  );
}
