'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, FileWarning, Loader2 } from 'lucide-react';
import {
  fetchApplicantMe,
  fetchPaymentInfo,
  saveFormDraft,
  submitApplication,
  uploadApplicantDocument,
} from '@/services/admissions-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { usePortalCycleSettings } from '@/hooks/use-portal-cycle-settings';
import { formatInr } from '@/components/admissions-portal/cycle-settings';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/utils/api-error';
import { AdmissionsApplicantLayout } from './admissions-applicant-layout';
import {
  APPLICANT_FORM_STEPS,
  DOC_SLOTS,
  UPLOAD_DOC_SLOTS,
  findMissingRequiredDocuments,
  stepProgressPercent,
} from './constants';
import { formatLastSaved } from './utils';
import {
  AcademicSection,
  AddressesSection,
  FamilySection,
  PersonalSection,
} from './sections/form-sections';
import { CoursePreferencesSection } from './sections/course-preferences-section';

export function AdmissionsApplicationWizard() {
  const enabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Record<string, Record<string, unknown>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoSaveReady = useRef(false);

  const { data: me, isLoading } = useQuery({
    queryKey: ['applicant-me'],
    queryFn: fetchApplicantMe,
    enabled,
  });

  const paymentQuery = useQuery({
    queryKey: ['applicant-payment-info'],
    queryFn: fetchPaymentInfo,
    enabled,
  });

  const { settings: cycleSettings } = usePortalCycleSettings();

  useEffect(() => {
    if (!me?.application) return;
    setStep(me.application.currentStep || 1);
    const loaded = (me.application.formData as Record<string, Record<string, unknown>>) ?? {};
    const personal = loaded.personal ?? {};
    if (!personal.fullName && (personal.firstName || me.application.firstName)) {
      loaded.personal = {
        ...personal,
        fullName: String(
          personal.fullName ?? personal.firstName ?? me.application.firstName ?? '',
        ).trim(),
        email: personal.email ?? me.application.email,
        mobile: personal.mobile ?? personal.phone ?? me.application.phone ?? '',
      };
    }
    setFormData(loaded);
    autoSaveReady.current = true;
  }, [me?.application?.id]);

  const readOnly = me?.readOnly ?? false;
  const progressPercent = stepProgressPercent(step);
  const lastSavedLabel = formatLastSaved(me?.application.lastSavedAt);
  const current = APPLICANT_FORM_STEPS[step - 1];
  const feePaid =
    me?.application.paymentStatus === 'PAID' || me?.application.paymentStatus === 'WAIVED';
  const missingDocs = findMissingRequiredDocuments(
    me?.application.documents?.map((d) => d.slotCode) ?? [],
    formData,
  );
  const docsComplete = missingDocs.length === 0;
  const showPaymentReminder = step === 7 && !readOnly && !feePaid;
  const showDocumentsReminder = step === 7 && !readOnly && !docsComplete;

  const debouncedForm = useDebouncedValue(formData, 2000);

  const saveMutation = useMutation({
    mutationFn: (payload: { step: number; silent?: boolean }) =>
      saveFormDraft({
        currentStep: payload.step,
        formData: debouncedForm,
        progressPercent: stepProgressPercent(payload.step),
      }),
    onSuccess: (_data, vars) => {
      if (!vars.silent) setMessage('Draft saved');
      queryClient.invalidateQueries({ queryKey: ['applicant-me'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Failed to save draft')),
  });

  const submitMutation = useMutation({
    mutationFn: submitApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant-me'] });
      setMessage('Application submitted successfully');
    },
    onError: (e) => setError(apiErrorMessage(e, 'Failed to submit')),
  });

  useEffect(() => {
    if (!autoSaveReady.current || readOnly) return;
    if (!Object.keys(debouncedForm).length) return;
    saveMutation.mutate({ step, silent: true });
  }, [debouncedForm, step, readOnly]);

  const updateSection = useCallback((key: string, field: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), [field]: value },
    }));
    setMessage(null);
  }, []);

  const renderStep = () => {
    if (!current) return null;
    const values = formData[current.key] ?? {};

    switch (current.key) {
      case 'personal':
        return (
          <PersonalSection
            values={values}
            readOnly={readOnly}
            onChange={(field, value) => updateSection('personal', field, value)}
          />
        );
      case 'addresses':
        return (
          <AddressesSection
            values={values}
            readOnly={readOnly}
            onChange={(field, value) => updateSection('addresses', field, value)}
          />
        );
      case 'family':
        return (
          <FamilySection
            values={values}
            readOnly={readOnly}
            onChange={(field, value) => updateSection('family', field, value)}
          />
        );
      case 'academic':
        return (
          <AcademicSection
            values={values}
            readOnly={readOnly}
            onChange={(field, value) => updateSection('academic', field, value)}
          />
        );
      case 'coursePreferences':
        return (
          <CoursePreferencesSection
            values={values}
            readOnly={readOnly}
            programVersionId={me?.catalogContext?.programVersionId}
            shifts={me?.catalogContext?.shifts}
            streamId={String(
              (formData.academic as Record<string, unknown> | undefined)?.streamId ?? '',
            )}
            onChange={(field, value) => updateSection('coursePreferences', field, value)}
          />
        );
      case 'uploads':
        return (
          <div className="rounded-xl bg-[#1a2b4b] p-5 text-white">
            <p className="mb-4 text-sm text-slate-300">
              Upload clear scans or PDFs. JPEG, PNG, or PDF — max 5 MB per file. Fields marked * are
              required when applicable.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {UPLOAD_DOC_SLOTS.map(({ code, label, required }) => {
                const uploaded = me?.application.documents?.find((d) => d.slotCode === code);
                return (
                  <div key={code} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-medium">
                      {label}
                      {required ? ' *' : ''}
                    </p>
                    {uploaded ? (
                      <p className="mt-1 text-xs text-emerald-300">Uploaded</p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">Not uploaded</p>
                    )}
                    <input
                      type="file"
                      className="mt-3 block w-full text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-[#2563eb] file:px-3 file:py-1 file:text-white"
                      disabled={readOnly}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          await uploadApplicantDocument(code, file);
                          setMessage(`${label} uploaded`);
                          queryClient.invalidateQueries({ queryKey: ['applicant-me'] });
                        } catch (err) {
                          setError(apiErrorMessage(err, 'Upload failed'));
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      default:
        return (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
            <label className="flex items-start gap-3 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-1"
                disabled={readOnly}
                checked={Boolean((formData.declaration ?? {}).agreed)}
                onChange={(e) => updateSection('declaration', 'agreed', e.target.checked)}
              />
              <span>
                I declare that the information provided is true to the best of my knowledge and I
                agree to abide by the rules and regulations of Don Bosco College, Tura.
              </span>
            </label>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <AdmissionsApplicantLayout>
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading your application…
        </div>
      </AdmissionsApplicantLayout>
    );
  }

  return (
    <AdmissionsApplicantLayout
      showFormSections
      formCurrentStep={step}
      formProgressPercent={me?.application.progressPercent ?? progressPercent}
      formMaxStep={me?.application.currentStep ?? step}
      formReadOnly={readOnly}
      onFormStepClick={(s) => setStep(s)}
    >
      {readOnly ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Your application is submitted. You can review details but cannot edit them.
        </p>
      ) : null}

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-[#1a2b4b]">
            Step {step} of 7 — {current?.title}
          </span>
          <span className="font-semibold text-[#2563eb]">{progressPercent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#2563eb] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-[#1a2b4b]">Admission Application</h2>
        <p className="mt-1 text-sm text-slate-600">
          Review and complete each section. Your progress is saved as a draft so you can resume
          later.
        </p>
        {lastSavedLabel ? (
          <p className="mt-2 text-xs text-slate-500">
            Last saved: {lastSavedLabel}
            {saveMutation.isPending ? ' · Saving…' : ''}
          </p>
        ) : null}

        <div className="mt-6 space-y-4">{renderStep()}</div>

        {showDocumentsReminder ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p>
              <strong>Required documents missing.</strong> Upload:{' '}
              {missingDocs
                .map((code) => DOC_SLOTS.find((slot) => slot.code === code)?.label ?? code)
                .join(', ')}
            </p>
            <Button asChild size="sm" variant="outline" className="rounded-full border-amber-400">
              <Link href="/admissions-portal/documents">
                <FileWarning className="mr-2 h-4 w-4" />
                Upload documents
              </Link>
            </Button>
          </div>
        ) : null}

        {showPaymentReminder ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
            <p>
              <strong>Application fee required.</strong> You must pay the fee before submitting.
              {paymentQuery.data?.configured
                ? ` Pay ${formatInr(paymentQuery.data.applicationFee ?? cycleSettings.applicationFee)} online to unlock submission.`
                : ` Pay ${formatInr(cycleSettings.applicationFee)} at the college office and ask admissions to confirm your payment.`}
            </p>
            {paymentQuery.data?.canPay ? (
              <Button asChild size="sm" className="rounded-full bg-rose-700 hover:bg-rose-800">
                <Link href="/admissions-portal/payments">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay fee
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}

        {message ? <p className="mt-4 text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {!readOnly ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Previous
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-[#2563eb] text-[#2563eb]"
                onClick={() => saveMutation.mutate({ step })}
                disabled={saveMutation.isPending}
              >
                Save Draft
              </Button>
              {step < 7 ? (
                <Button
                  className="rounded-full bg-[#2563eb] px-6"
                  onClick={() =>
                    saveMutation.mutate(
                      { step },
                      { onSuccess: () => setStep((s) => Math.min(7, s + 1)) },
                    )
                  }
                >
                  Next →
                </Button>
              ) : (
                <Button
                  className="rounded-full bg-[#2563eb] px-6"
                  onClick={() => submitMutation.mutate()}
                  disabled={
                    submitMutation.isPending ||
                    !formData.declaration?.agreed ||
                    !feePaid ||
                    !docsComplete
                  }
                >
                  Submit Application
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </AdmissionsApplicantLayout>
  );
}
