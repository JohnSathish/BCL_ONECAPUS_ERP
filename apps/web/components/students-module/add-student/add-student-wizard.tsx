'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { AddStudentPageShell } from '@/components/students-module/add-student/add-student-page-shell';
import { AddStudentStepper } from '@/components/students-module/add-student/add-student-stepper';
import {
  AddStudentSummaryMobileBar,
  AddStudentSummaryPanel,
} from '@/components/students-module/add-student/add-student-summary-panel';
import { WIZARD_STEPS } from '@/components/students-module/add-student/constants';
import { StepAcademic } from '@/components/students-module/add-student/steps/step-academic';
import { StepBasic } from '@/components/students-module/add-student/steps/step-basic';
import { StepFyugpBasket } from '@/components/students-module/add-student/steps/step-fyugp-basket';
import { StepMisc } from '@/components/students-module/add-student/steps/step-misc';
import { StepDocuments } from '@/components/students-module/add-student/steps/step-documents';
import {
  createEmptyDraft,
  type AddStudentDraft,
} from '@/components/students-module/add-student/types/draft';
import type {
  BatchMeta,
  LookupOptions,
} from '@/components/students-module/add-student/types/lookups';
import {
  firstStepError,
  validateAdmissionSubmit,
  validateStepFields,
} from '@/components/students-module/add-student/utils/admission-validation';
import { buildAdmitWithRegistrationPayload } from '@/components/students-module/add-student/utils/build-admit-payload';
import {
  dataUrlToPhotoFile,
  isEphemeralPhotoUrl,
  isPersistablePhotoUrl,
} from '@/components/students-module/add-student/utils/photo-utils';
import {
  clearDraftStorage,
  hasRecoverableDraft,
  isPristineDraft,
  loadDraftFromStorage,
  mergeWithEmptyDraft,
  saveDraftToStorage,
} from '@/components/students-module/add-student/utils/draft-storage';
import { buildProgramVersionDepartmentMap } from '@/components/students-module/add-student/utils/program-department-map';
import { DirectoryGlassCard } from '@/components/students-module/directory/ui/directory-glass-card';
import { PostAdmitRegistrationActions } from '@/components/students-module/directory/post-admit-registration-actions';
import { ErpWorkspace, ErpWorkspaceGrid } from '@/components/erp/erp-workspace-shell';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useRequireAuth } from '@/hooks/use-auth';
import { toShiftOptions } from '@/lib/shift-options';
import { fetchAcademicStreams } from '@/services/academic-engine';
import { fetchAdmissionBatches } from '@/services/academic-lifecycle';
import {
  fetchAcademicDepartments,
  fetchCampuses,
  fetchInstitutions,
} from '@/services/organization';
import { fetchPrograms } from '@/services/programs';
import { fetchShifts } from '@/services/shifts';
import {
  admitStudentWithRegistration,
  fetchMasterLookups,
  uploadStudentDocument,
  uploadStudentPhoto,
} from '@/services/students';
import type { StudentProfile } from '@/types/students';
import { apiErrorMessage } from '@/utils/api-error';
import { previewRollNumber } from '@/services/roll-number';

export type { AddStudentDraft } from '@/components/students-module/add-student/types/draft';
export { buildAdmitFullPayload } from '@/components/students-module/add-student/utils/build-admit-payload';

export function AddStudentWizard() {
  const session = useRequireAuth();
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [draft, setDraft] = useState<AddStudentDraft>(() => createEmptyDraft());
  const [savedDraft, setSavedDraft] = useState<AddStudentDraft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState('');
  const [admittedProfile, setAdmittedProfile] = useState<StudentProfile | null>(null);
  const [savedLabel, setSavedLabel] = useState('');
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [documentFiles, setDocumentFiles] = useState<Record<string, File>>({});
  const [rollPreviewLoading, setRollPreviewLoading] = useState(false);
  const admissionCompleteRef = useRef(false);

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
    if (admissionCompleteRef.current) return;
    if (savedDraft && isPristineDraft(debouncedDraft)) return;
    saveDraftToStorage(debouncedDraft);
    markDraftSaved();
  }, [debouncedDraft, savedDraft, markDraftSaved]);

  const persistDraftNow = useCallback(
    (nextDraft: AddStudentDraft = draft) => {
      saveDraftToStorage(nextDraft);
      markDraftSaved();
    },
    [draft, markDraftSaved],
  );

  const refreshRollPreview = useCallback(async () => {
    if (!draft.rollNumberAutoGenerated || !draft.streamId || !draft.admissionBatchId) {
      setDraft((d) => ({ ...d, rollNumberPreview: '' }));
      return;
    }
    setRollPreviewLoading(true);
    try {
      const preview = await previewRollNumber({
        streamId: draft.streamId,
        admissionBatchId: draft.admissionBatchId,
      });
      setDraft((d) => ({ ...d, rollNumberPreview: preview.rollNumber }));
    } catch {
      setDraft((d) => ({ ...d, rollNumberPreview: '' }));
    } finally {
      setRollPreviewLoading(false);
    }
  }, [draft.streamId, draft.admissionBatchId, draft.rollNumberAutoGenerated, setDraft]);

  useEffect(() => {
    if (!draft.rollNumberAutoGenerated) return;
    if (!draft.streamId || !draft.admissionBatchId) {
      setDraft((d) => (d.rollNumberPreview ? { ...d, rollNumberPreview: '' } : d));
      return;
    }
    const timer = window.setTimeout(() => {
      void refreshRollPreview();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    draft.streamId,
    draft.admissionBatchId,
    draft.rollNumberAutoGenerated,
    refreshRollPreview,
    setDraft,
  ]);

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

  const programs = useQuery({
    queryKey: ['catalog', 'programs'],
    queryFn: () => fetchPrograms(1),
    enabled: Boolean(session),
  });
  const shifts = useQuery({
    queryKey: ['shifts', campusId, 'ACTIVE'],
    queryFn: () => fetchShifts({ campusId, status: 'ACTIVE' }),
    enabled: Boolean(session) && Boolean(campusId),
  });
  const streams = useQuery({
    queryKey: ['academic-engine', 'streams'],
    queryFn: fetchAcademicStreams,
    enabled: Boolean(session),
  });
  const batches = useQuery({
    queryKey: ['academic-lifecycle', 'batches', institutionId],
    queryFn: () => fetchAdmissionBatches(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });
  const departments = useQuery({
    queryKey: ['org', 'departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
    enabled: Boolean(session),
  });
  const categories = useQuery({
    queryKey: ['master-lookups', 'CATEGORY'],
    queryFn: () => fetchMasterLookups('CATEGORY'),
    enabled: Boolean(session),
  });
  const religions = useQuery({
    queryKey: ['master-lookups', 'RELIGION'],
    queryFn: () => fetchMasterLookups('RELIGION'),
    enabled: Boolean(session),
  });
  const bloodGroups = useQuery({
    queryKey: ['master-lookups', 'BLOOD_GROUP'],
    queryFn: () => fetchMasterLookups('BLOOD_GROUP'),
    enabled: Boolean(session),
  });
  const nationalities = useQuery({
    queryKey: ['master-lookups', 'NATIONALITY'],
    queryFn: () => fetchMasterLookups('NATIONALITY'),
    enabled: Boolean(session),
  });
  const tribes = useQuery({
    queryKey: ['master-lookups', 'TRIBE'],
    queryFn: () => fetchMasterLookups('TRIBE'),
    enabled: Boolean(session),
  });
  const denominations = useQuery({
    queryKey: ['master-lookups', 'DENOMINATION'],
    queryFn: () => fetchMasterLookups('DENOMINATION'),
    enabled: Boolean(session),
  });

  const programVersions = useMemo(() => {
    const rows: { id: string; label: string }[] = [];
    for (const p of programs.data?.data ?? []) {
      for (const v of p.versions ?? []) {
        if (v.status === 'PUBLISHED') rows.push({ id: v.id, label: `${p.code} v${v.version}` });
      }
    }
    return rows;
  }, [programs.data]);

  const batchMeta: BatchMeta[] = useMemo(
    () =>
      (batches.data ?? []).map((b) => ({
        id: b.id,
        currentSemester: b.currentSemester,
        programVersionId: (b as { programVersionId?: string }).programVersionId,
      })),
    [batches.data],
  );

  const programVersionDepartmentMap = useMemo(
    () => buildProgramVersionDepartmentMap(programs.data?.data),
    [programs.data],
  );

  const lookups: LookupOptions = {
    programOptions: programVersions,
    batchOptions: (batches.data ?? []).map((b) => ({
      id: b.id,
      label: `${b.batchCode} (Sem ${b.currentSemester})`,
    })),
    streamOptions: (streams.data ?? []).map((s) => ({ id: s.id, label: s.name })),
    shiftOptions: toShiftOptions(shifts.data ?? []),
    departmentOptions: (departments.data ?? []).map((d) => ({ id: d.id, label: d.name })),
    programVersionDepartmentMap,
    categoryOptions: (categories.data ?? []).map((c) => ({ id: c.id, label: c.label })),
    religionOptions: (religions.data ?? []).map((c) => ({ id: c.id, label: c.label })),
    bloodGroupOptions: (bloodGroups.data ?? []).map((c) => ({ id: c.id, label: c.label })),
    nationalityOptions: (nationalities.data ?? []).map((c) => ({ id: c.id, label: c.label })),
    tribeOptions: (tribes.data ?? []).map((c) => ({ id: c.id, label: c.label })),
    denominationOptions: (denominations.data ?? []).map((c) => ({ id: c.id, label: c.label })),
  };

  const programmeLabel = programVersions.find((p) => p.id === draft.programVersionId)?.label;
  const batchLabel = lookups.batchOptions.find((b) => b.id === draft.admissionBatchId)?.label;

  const admitMut = useMutation({
    mutationFn: async (input: {
      payload: ReturnType<typeof buildAdmitWithRegistrationPayload>;
      photoDataUrl?: string;
      pendingDocuments: AddStudentDraft['pendingDocuments'];
      documentFiles: Record<string, File>;
    }) => {
      const profile = await admitStudentWithRegistration(input.payload);
      let photoWarning: string | undefined;
      const documentWarnings: string[] = [];

      if (input.photoDataUrl && isPersistablePhotoUrl(input.photoDataUrl)) {
        const file = dataUrlToPhotoFile(input.photoDataUrl);
        if (file) {
          try {
            await uploadStudentPhoto(profile.id, file);
          } catch (error) {
            photoWarning = apiErrorMessage(error, 'Photo could not be uploaded');
          }
        } else {
          photoWarning =
            'Photo could not be prepared for upload. Re-upload from the student profile.';
        }
      } else if (input.photoDataUrl && isEphemeralPhotoUrl(input.photoDataUrl)) {
        photoWarning =
          'Photo was not saved with the draft. Open the student profile and upload the photo again.';
      }

      for (const doc of input.pendingDocuments) {
        const file = input.documentFiles[doc.id];
        if (!file) continue;
        try {
          await uploadStudentDocument(profile.id, doc.documentType, file);
        } catch (error) {
          documentWarnings.push(apiErrorMessage(error, `${doc.fileName} could not be uploaded`));
        }
      }

      const warning = [photoWarning, ...documentWarnings].filter(Boolean).join(' ');
      return { profile, warning: warning || undefined };
    },
    onSuccess: ({ profile, warning }) => {
      admissionCompleteRef.current = true;
      clearDraftStorage();
      setSavedDraft(null);
      setDraft(createEmptyDraft());
      setDocumentFiles({});
      setAdmittedProfile(profile);
      setBannerError(warning ?? '');
    },
    onError: (e) => setBannerError(apiErrorMessage(e, 'Admission failed')),
  });

  const validateCurrentStep = useCallback(() => {
    const errors = validateStepFields(step.id, draft, {
      requireMajor: Boolean(draft.programVersionId),
      requireMinor:
        draft.subjectBasketMeta.minorRequired ?? (draft.programVersionId ? undefined : false),
    });
    setFieldErrors(errors);
    const msg = firstStepError(errors);
    if (msg) setBannerError(msg);
    return !msg;
  }, [step.id, draft]);

  const goNext = () => {
    if (!validateCurrentStep()) return;
    setBannerError('');
    persistDraftNow();
    setStepIndex((i) => {
      const next = Math.min(i + 1, WIZARD_STEPS.length - 1);
      setMaxReached((m) => Math.max(m, next));
      return next;
    });
  };

  const goBack = () => {
    setBannerError('');
    setFieldErrors({});
    persistDraftNow();
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const submit = (mode: 'NONE' | 'DRAFT' | 'SUBMIT') => {
    persistDraftNow();
    const errors = validateAdmissionSubmit(draft, mode, validationIssues);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setBannerError(firstStepError(errors) ?? 'Fix validation errors');
      return;
    }
    setBannerError('');
    admitMut.mutate({
      payload: buildAdmitWithRegistrationPayload(draft, {
        registrationAction: mode,
      }),
      photoDataUrl: draft.photoPreviewUrl || undefined,
      pendingDocuments: draft.pendingDocuments,
      documentFiles,
    });
  };

  if (!session) return null;

  if (admittedProfile) {
    return (
      <ErpWorkspace className="max-w-3xl space-y-3">
        <DirectoryGlassCard className="p-4">
          <h2 className="text-base font-semibold">Admission complete</h2>
          <div className="mt-3">
            <PostAdmitRegistrationActions
              profile={admittedProfile}
              onDone={() => router.push(`/admin/students/${admittedProfile.id}?tab=overview`)}
            />
          </div>
        </DirectoryGlassCard>
      </ErpWorkspace>
    );
  }

  const summaryPanel = (
    <AddStudentSummaryPanel
      draft={draft}
      programmeLabel={programmeLabel}
      batchLabel={batchLabel}
      validationIssues={validationIssues}
    />
  );

  return (
    <ErpWorkspace className="space-y-2 pb-20 lg:pb-4">
      <Link href="/admin/students" className="text-[11px] text-muted-foreground hover:text-primary">
        ← Student directory
      </Link>

      {savedDraft ? (
        <div className="glass-card rounded-lg border border-primary/20 px-2.5 py-1.5 text-xs">
          Unfinished registration
          {savedDraft.fullName ? ` for ${savedDraft.fullName}` : ''}.{' '}
          <button
            type="button"
            className="text-primary underline"
            onClick={() => {
              setDraft(mergeWithEmptyDraft(savedDraft));
              setSavedDraft(null);
              setStepIndex(0);
              setMaxReached(WIZARD_STEPS.length - 1);
              setFieldErrors({});
              setBannerError('');
            }}
          >
            Resume draft
          </button>
          {' · '}
          <button
            type="button"
            className="text-primary underline"
            onClick={() => {
              clearDraftStorage();
              setSavedDraft(null);
            }}
          >
            Discard
          </button>
        </div>
      ) : null}

      <AddStudentPageShell draft={draft} stepLabel={step.label} savedLabel={savedLabel}>
        <AddStudentStepper
          stepIndex={stepIndex}
          maxReached={maxReached}
          onStepClick={(i) => {
            if (i <= maxReached) {
              persistDraftNow();
              setStepIndex(i);
              setFieldErrors({});
              setBannerError('');
            }
          }}
        />

        <ErpWorkspaceGrid
          main={
            <DirectoryGlassCard className="overflow-visible p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                <h2 className="text-sm font-semibold">
                  Step {stepIndex + 1}: {step.label}
                </h2>
              </div>
              {bannerError ? (
                <p className="mb-2 whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                  {bannerError}
                </p>
              ) : null}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                  className="motion-reduce:transition-none overflow-visible"
                >
                  {step.id === 'basic' ? (
                    <StepBasic
                      draft={draft}
                      setDraft={setDraft}
                      lookups={lookups}
                      errors={fieldErrors}
                      rollPreviewLoading={rollPreviewLoading}
                      onRefreshRollPreview={() => void refreshRollPreview()}
                    />
                  ) : null}
                  {step.id === 'academic' ? (
                    <StepAcademic
                      draft={draft}
                      setDraft={setDraft}
                      lookups={lookups}
                      batchMeta={batchMeta}
                      errors={fieldErrors}
                    />
                  ) : null}
                  {step.id === 'fyugp' ? (
                    <StepFyugpBasket
                      draft={draft}
                      setDraft={setDraft}
                      errors={fieldErrors}
                      onValidationIssues={setValidationIssues}
                    />
                  ) : null}
                  {['guardians', 'address', 'reservation', 'board', 'review'].includes(step.id) ? (
                    <StepMisc
                      step={step.id}
                      draft={draft}
                      setDraft={setDraft}
                      lookups={lookups}
                      programmeLabel={programmeLabel}
                      onJumpToStep={setStepIndex}
                    />
                  ) : null}
                  {step.id === 'documents' ? (
                    <StepDocuments
                      draft={draft}
                      setDraft={setDraft}
                      documentFiles={documentFiles}
                      setDocumentFiles={setDocumentFiles}
                    />
                  ) : null}
                </motion.div>
              </AnimatePresence>

              <div className="sticky bottom-0 z-20 -mx-3 mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 bg-card/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/90 sm:-mx-0 sm:rounded-b-xl lg:static lg:border-t lg:bg-transparent lg:px-0 lg:py-4 lg:backdrop-blur-none">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={stepIndex === 0}
                  onClick={goBack}
                >
                  Back
                </Button>
                {step.id === 'review' ? (
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => persistDraftNow()}
                      >
                        Save draft locally
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={admitMut.isPending}
                        onClick={() => submit('NONE')}
                      >
                        Admit only
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={admitMut.isPending}
                        onClick={() => submit('SUBMIT')}
                      >
                        Complete admission
                      </Button>
                    </div>
                    <p className="max-w-md text-right text-[10px] text-muted-foreground">
                      Use <strong>Complete admission</strong> for FYUGP — admits the student,
                      assigns roll number when auto-generated, and registers Semester subjects.
                      Requires exactly {draft.subjectBasketMeta.creditsTarget || 20} credits on the
                      Subjects step.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => persistDraftNow()}
                    >
                      Save draft
                    </Button>
                    <Button type="button" size="sm" onClick={goNext}>
                      Next
                    </Button>
                  </div>
                )}
              </div>
            </DirectoryGlassCard>
          }
          sidebar={summaryPanel}
        />
      </AddStudentPageShell>

      <AddStudentSummaryMobileBar
        draft={draft}
        programmeLabel={programmeLabel}
        onExpand={() => setMobileSummaryOpen(true)}
      />

      {mobileSummaryOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close summary"
            onClick={() => setMobileSummaryOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Live summary</h3>
              <button type="button" onClick={() => setMobileSummaryOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            {summaryPanel}
          </div>
        </div>
      ) : null}
    </ErpWorkspace>
  );
}
