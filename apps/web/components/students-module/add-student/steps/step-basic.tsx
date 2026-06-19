'use client';

import { IdCard, RefreshCw, Tags, UserRound } from 'lucide-react';

import { AdmissionFormField } from '@/components/students-module/add-student/ui/admission-form-field';
import { nehuRegistrationPendingWarning } from '@/components/students-module/add-student/constants/nehu-fields';
import { AdmissionFormSection } from '@/components/students-module/add-student/ui/admission-form-section';
import { AdmissionPhotoUpload } from '@/components/students-module/add-student/ui/admission-photo-upload';
import {
  GlassField,
  admissionFormGridClass,
  glassInputClass,
  glassSelectClass,
} from '@/components/students-module/add-student/ui/glass-field';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { capitalizeName } from '@/components/students-module/add-student/utils/admission-validation';
import { revokePhotoPreviewUrl } from '@/components/students-module/add-student/utils/photo-utils';
import type { AddStudentDraft } from '@/components/students-module/add-student/types/draft';
import type { LookupOptions } from '@/components/students-module/add-student/types/lookups';
import { SupportDataSelect } from '@/components/administration-module/support-data/support-data-select';
import { useSupportDataOptions } from '@/hooks/use-support-data';
import { cn } from '@/utils/cn';

const NEHU_HELPER =
  'Issued later by NEHU. Semester 1 students can be admitted without this — update when the university assigns the number.';

type Props = {
  draft: AddStudentDraft;
  setDraft: React.Dispatch<React.SetStateAction<AddStudentDraft>>;
  lookups: LookupOptions;
  errors: Record<string, string>;
  rollPreviewLoading?: boolean;
  onRefreshRollPreview?: () => void;
};

export function StepBasic({
  draft,
  setDraft,
  lookups,
  errors,
  rollPreviewLoading,
  onRefreshRollPreview,
}: Props) {
  const genderOptions = useSupportDataOptions('gender');
  const semester = draft.currentSemester ?? 1;
  const nehuWarning = nehuRegistrationPendingWarning(semester, draft.enrollmentNumber);

  const fieldSuccess = (key: keyof AddStudentDraft, minLen = 1) => {
    const v = draft[key];
    if (typeof v !== 'string' || errors[key as string]) return false;
    return v.trim().length >= minLen;
  };

  return (
    <div className="space-y-5">
      {nehuWarning ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:text-amber-50">
          {nehuWarning}
        </p>
      ) : null}

      <AdmissionFormSection
        icon={UserRound}
        title="Identity"
        description="Core student identification details."
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <AdmissionFormField
              label="Full Name"
              fieldKey="fullName"
              required
              error={errors.fullName}
              success={fieldSuccess('fullName', 2)}
              className="max-w-none"
            >
              <input
                className={glassInputClass}
                value={draft.fullName}
                onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
                onBlur={(e) =>
                  setDraft((d) => ({ ...d, fullName: capitalizeName(e.target.value) }))
                }
                autoComplete="name"
                placeholder="Student full name as per records"
              />
            </AdmissionFormField>

            <div className={cn(admissionFormGridClass)}>
              <AdmissionFormField
                label="Email"
                fieldKey="email"
                required
                error={errors.email}
                success={fieldSuccess('email', 3) && draft.email.includes('@')}
              >
                <input
                  type="email"
                  className={glassInputClass}
                  value={draft.email}
                  onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                  autoComplete="email"
                  placeholder="student@example.com"
                />
              </AdmissionFormField>
              <AdmissionFormField label="Application No." fieldKey="applicationNumber">
                <input
                  className={cn(glassInputClass, 'bg-muted/40')}
                  value={draft.applicationNumber}
                  readOnly
                />
              </AdmissionFormField>
              <AdmissionFormField
                label="NEHU Registration Number"
                fieldKey="enrollmentNumber"
                optional
                error={errors.enrollmentNumber}
                hint={NEHU_HELPER}
                success={fieldSuccess('enrollmentNumber', 2)}
              >
                <input
                  className={glassInputClass}
                  value={draft.enrollmentNumber}
                  onChange={(e) => setDraft((d) => ({ ...d, enrollmentNumber: e.target.value }))}
                  placeholder="Leave blank for Semester 1 — add when NEHU assigns"
                />
              </AdmissionFormField>
              <AdmissionFormField
                label="Mobile Number"
                fieldKey="mobileNumber"
                required
                error={errors.mobileNumber}
                success={fieldSuccess('mobileNumber', 10)}
              >
                <input
                  className={glassInputClass}
                  inputMode="numeric"
                  value={draft.mobileNumber}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10),
                    }))
                  }
                  autoComplete="tel"
                  placeholder="10-digit mobile"
                />
              </AdmissionFormField>
              <AdmissionFormField
                label="Roll Number"
                fieldKey="rollNumber"
                error={errors.rollNumber}
                hint={
                  draft.rollNumberAutoGenerated
                    ? 'Generated from stream + admission year. Assigned on admit.'
                    : 'Enter a unique college roll number manually.'
                }
                labelAction={
                  <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      checked={draft.rollNumberAutoGenerated}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          rollNumberAutoGenerated: e.target.checked,
                          rollNumber: e.target.checked ? '' : d.rollNumber,
                        }))
                      }
                    />
                    Auto-generated
                  </label>
                }
              >
                <div className="flex w-full gap-2">
                  <input
                    className={cn(glassInputClass, draft.rollNumberAutoGenerated && 'bg-muted/40')}
                    value={
                      draft.rollNumberAutoGenerated
                        ? draft.rollNumberPreview || (rollPreviewLoading ? 'Generating…' : '—')
                        : draft.rollNumber
                    }
                    readOnly={draft.rollNumberAutoGenerated}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, rollNumber: e.target.value.toUpperCase() }))
                    }
                    placeholder={
                      draft.rollNumberAutoGenerated ? 'Select programme & batch' : 'e.g. BA26-001'
                    }
                  />
                  {draft.rollNumberAutoGenerated ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-12 shrink-0 px-2"
                      disabled={rollPreviewLoading || !onRefreshRollPreview}
                      onClick={onRefreshRollPreview}
                      title="Refresh preview"
                    >
                      <RefreshCw className={cn('h-4 w-4', rollPreviewLoading && 'animate-spin')} />
                    </Button>
                  ) : null}
                </div>
              </AdmissionFormField>
              <AdmissionFormField
                label="NEHU Roll Number"
                fieldKey="nehuRollNumber"
                optional
                error={errors.nehuRollNumber}
                hint={NEHU_HELPER}
                success={fieldSuccess('nehuRollNumber', 2)}
              >
                <input
                  className={glassInputClass}
                  value={draft.nehuRollNumber}
                  onChange={(e) => setDraft((d) => ({ ...d, nehuRollNumber: e.target.value }))}
                  placeholder="University roll no. (optional for Sem 1)"
                />
              </AdmissionFormField>
              <AdmissionFormField
                label="ABC ID"
                fieldKey="abcId"
                optional
                error={errors.abcId}
                hint="Academic Bank of Credits ID — alphanumeric, optional at admission."
                success={fieldSuccess('abcId', 1)}
              >
                <input
                  className={glassInputClass}
                  value={draft.abcId}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      abcId: e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 50),
                    }))
                  }
                  placeholder="Enter ABC ID"
                  maxLength={50}
                />
              </AdmissionFormField>
            </div>
          </div>

          <AdmissionPhotoUpload
            photoPreviewUrl={draft.photoPreviewUrl}
            onPhotoChange={(dataUrl) =>
              setDraft((d) => {
                if (d.photoPreviewUrl && d.photoPreviewUrl !== dataUrl) {
                  revokePhotoPreviewUrl(d.photoPreviewUrl);
                }
                return { ...d, photoPreviewUrl: dataUrl };
              })
            }
          />
        </div>
      </AdmissionFormSection>

      <AdmissionFormSection
        icon={IdCard}
        title="Personal Details"
        description="Demographic and identity information."
      >
        <div className={admissionFormGridClass}>
          <GlassField label="Gender" optional>
            <SupportDataSelect
              category="gender"
              className={glassSelectClass}
              value={draft.gender}
              options={genderOptions.options}
              loading={genderOptions.isLoading}
              onChange={(gender) => setDraft((d) => ({ ...d, gender }))}
            />
          </GlassField>
          <AdmissionFormField
            label="Date of Birth"
            fieldKey="dateOfBirth"
            error={errors.dateOfBirth}
            success={fieldSuccess('dateOfBirth', 8)}
          >
            <DateInput
              className={glassInputClass}
              value={draft.dateOfBirth}
              onChange={(dateOfBirth) => setDraft((d) => ({ ...d, dateOfBirth }))}
            />
          </AdmissionFormField>
          <GlassField label="Aadhaar / National ID" error={errors.nationalId} optional>
            <input
              className={glassInputClass}
              inputMode="numeric"
              value={draft.nationalId}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  nationalId: e.target.value.replace(/\D/g, '').slice(0, 12),
                }))
              }
              placeholder="12 digits"
            />
          </GlassField>
          <GlassField label="Blood Group" optional>
            <select
              className={glassSelectClass}
              value={draft.bloodGroupLookupId}
              onChange={(e) => setDraft((d) => ({ ...d, bloodGroupLookupId: e.target.value }))}
            >
              <option value="">Select blood group</option>
              {lookups.bloodGroupOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </GlassField>
          <GlassField label="Nationality" optional>
            <select
              className={glassSelectClass}
              value={draft.nationalityLookupId}
              onChange={(e) => setDraft((d) => ({ ...d, nationalityLookupId: e.target.value }))}
            >
              <option value="">Select nationality</option>
              {lookups.nationalityOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </GlassField>
          <GlassField label="Marital Status" optional>
            <select
              className={glassSelectClass}
              value={draft.maritalStatus}
              onChange={(e) => setDraft((d) => ({ ...d, maritalStatus: e.target.value }))}
            >
              <option value="">Select status</option>
              <option value="SINGLE">Single</option>
              <option value="MARRIED">Married</option>
            </select>
          </GlassField>
        </div>
      </AdmissionFormSection>

      <AdmissionFormSection
        icon={Tags}
        title="Reservation & Category"
        description="Community and admission classification."
        collapsible
        defaultOpen={Boolean(
          draft.religionLookupId || draft.categoryLookupId || draft.tribeLookupId,
        )}
      >
        <div className={admissionFormGridClass}>
          <GlassField label="Religion" optional>
            <select
              className={glassSelectClass}
              value={draft.religionLookupId}
              onChange={(e) => setDraft((d) => ({ ...d, religionLookupId: e.target.value }))}
            >
              <option value="">Select religion</option>
              {lookups.religionOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </GlassField>
          <GlassField label="Category" optional>
            <select
              className={glassSelectClass}
              value={draft.categoryLookupId}
              onChange={(e) => setDraft((d) => ({ ...d, categoryLookupId: e.target.value }))}
            >
              <option value="">Select category</option>
              {lookups.categoryOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </GlassField>
          <GlassField label="Tribe / Race" optional>
            <select
              className={glassSelectClass}
              value={draft.tribeLookupId}
              onChange={(e) => setDraft((d) => ({ ...d, tribeLookupId: e.target.value }))}
            >
              <option value="">Select tribe / race</option>
              {lookups.tribeOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </GlassField>
        </div>
      </AdmissionFormSection>
    </div>
  );
}
