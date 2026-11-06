'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button, buttonVariants } from '@/components/ui/button';
import { StudentPhotoUpload } from '@/components/student-records/student-photo-upload';
import {
  Field,
  FieldGrid,
  SectionCard,
  inputClass,
} from '@/components/student-profile/student-profile-shell';
import { StudentSubjectsTab } from '@/components/students-module/profile/student-subjects-tab';
import { SubjectChangeEditor } from '@/components/students-module/profile/subject-change-editor';
import { SearchableDepartmentSelect } from '@/components/students-module/add-student/ui/searchable-department-select';
import {
  deleteStudentDocument,
  fetchMasterLookups,
  updateStudentProfileSection,
  uploadStudentDocument,
  uploadStudentPhoto,
  verifyStudentDocument,
} from '@/services/students';
import { fetchAcademicDepartments } from '@/services/organization';
import { fetchBoardNames } from '@/services/support-data';
import { ClassXiiSubjectMarksEditor } from '@/components/students-module/class-xii-subject-marks-editor';
import { normalizeClass12Stream } from '@/services/class12-subjects';
import type { StudentProfile } from '@/types/students';
import type { ProfileSectionKey } from '@/types/student-profile';
import { DateInput } from '@/components/ui/date-input';
import { formatDisplayDateTime } from '@/utils/format-date';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { fetchStudentRollShiftHistory } from '@/services/roll-number';
import { emptyBoardExamSubjectRows, sanitizeBoardExamPayload } from '@/lib/board-exam-form';
import { isExcelImportedStudent } from '@/lib/student-admission-source';
import { formatCourseDisplayTitle } from '@/utils/format-course-title';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { GENDER_OPTIONS, normalizeGenderCode } from '@/lib/students/gender';
import {
  Award,
  CalendarDays,
  ExternalLink,
  GraduationCap,
  Home,
  Info,
  Layers,
  SunMedium,
} from 'lucide-react';
const STUDENT_STATUSES = ['STUDYING', 'ALUMNI', 'LEAVING', 'DETAINED', 'DROPPED'] as const;
const MARITAL_OPTIONS = [
  { value: 'SINGLE', label: 'Single' },
  { value: 'MARRIED', label: 'Married' },
] as const;

function normalizeMaritalStatus(value: string | null | undefined) {
  const raw = (value ?? '').trim();
  const key = raw.toUpperCase();
  if (key === 'SINGLE' || key === 'UNMARRIED') return 'SINGLE';
  if (key === 'MARRIED') return 'MARRIED';
  return raw;
}

const DOC_TYPES = [
  'MARKSHEETS_STD_X_ONWARDS',
  'CUET_CERTIFICATE',
  'CATEGORY_CERTIFICATE',
  'AGE_CERTIFICATE',
  'BAPTISM_CERTIFICATE',
  'AADHAAR',
  'MARKSHEET',
  'TC',
  'MIGRATION',
  'CASTE',
  'INCOME',
  'PHOTO',
  'ID_PROOF',
  'OTHER',
] as const;

function useDebouncedSave<T extends Record<string, unknown>>(
  studentId: string,
  sectionKey: ProfileSectionKey,
  values: T,
  enabled: boolean,
) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipInitial = useRef(true);
  const mut = useMutation({
    mutationFn: (payload: T) => updateStudentProfileSection(studentId, sectionKey, payload),
    onSuccess: () => {
      setMessage('Saved');
      void qc.invalidateQueries({ queryKey: ['students', studentId, 'profile'] });
      setTimeout(() => setMessage(''), 2000);
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Save failed')),
  });

  useEffect(() => {
    if (!enabled) return;
    if (skipInitial.current) {
      skipInitial.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      mut.mutate(values);
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values), enabled]);

  return { saving: mut.isPending, message };
}

export function BasicSection({ profile, canEdit }: { profile: StudentProfile; canEdit: boolean }) {
  const [form, setForm] = useState({
    applicationNumber: profile.applicationNumber ?? '',
    admissionNumber: profile.admissionNumber ?? '',
    enrollmentNumber: profile.enrollmentNumber,
    fullName: profile.fullName,
    email: profile.email ?? '',
    mobileNumber: profile.mobileNumber ?? '',
    dateOfBirth: profile.dateOfBirth?.slice(0, 10) ?? '',
    gender: normalizeGenderCode(profile.gender) || profile.gender || '',
    maritalStatus: normalizeMaritalStatus(profile.maritalStatus),
    nationalId: (profile.nationalId ?? '').replace(/\D/g, '').slice(0, 12),
    bloodGroupLookupId: profile.bloodGroupLookupId ?? '',
    studentStatus: profile.studentStatus ?? 'STUDYING',
    rfidNumber: profile.rfidNumber ?? '',
    departmentId: profile.departmentId ?? '',
  });
  const bloodGroups = useQuery({
    queryKey: ['master-lookups', 'BLOOD_GROUP'],
    queryFn: () => fetchMasterLookups('BLOOD_GROUP'),
  });
  const departments = useQuery({
    queryKey: ['org', 'departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
  });
  const departmentOptions = (departments.data ?? []).map((d) => ({
    id: d.id,
    label: d.name,
  }));
  const aadhaarDigits = form.nationalId.replace(/\D/g, '');
  const aadhaarError =
    aadhaarDigits.length > 0 && aadhaarDigits.length !== 12
      ? 'Aadhaar must be exactly 12 digits'
      : '';
  const savePayload = useMemo(() => {
    const { nationalId: _nationalId, ...rest } = form;
    return {
      ...rest,
      email: rest.email.trim() || undefined,
      departmentId: rest.departmentId || undefined,
      bloodGroupLookupId: rest.bloodGroupLookupId || null,
      ...(aadhaarDigits.length === 12
        ? { nationalId: aadhaarDigits }
        : aadhaarDigits.length === 0
          ? { nationalId: null }
          : {}),
    };
  }, [form, aadhaarDigits]);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [baseline, setBaseline] = useState(form);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const saveMut = useMutation({
    mutationFn: () => updateStudentProfileSection(profile.id, 'basic', savePayload),
    onSuccess: () => {
      setBaseline(form);
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ['students', profile.id, 'profile'] });
    },
  });
  useEffect(() => {
    if (dirty || saveMut.isPending) return;
    const next = {
      applicationNumber: profile.applicationNumber ?? '',
      admissionNumber: profile.admissionNumber ?? '',
      enrollmentNumber: profile.enrollmentNumber,
      fullName: profile.fullName,
      email: profile.email ?? '',
      mobileNumber: profile.mobileNumber ?? '',
      dateOfBirth: profile.dateOfBirth?.slice(0, 10) ?? '',
      gender: normalizeGenderCode(profile.gender) || profile.gender || '',
      maritalStatus: normalizeMaritalStatus(profile.maritalStatus),
      nationalId: (profile.nationalId ?? '').replace(/\D/g, '').slice(0, 12),
      bloodGroupLookupId: profile.bloodGroupLookupId ?? '',
      studentStatus: profile.studentStatus ?? 'STUDYING',
      rfidNumber: profile.rfidNumber ?? '',
      departmentId: profile.departmentId ?? '',
    };
    const serialized = JSON.stringify(next);
    setForm((current) => (JSON.stringify(current) === serialized ? current : next));
    setBaseline((current) => (JSON.stringify(current) === serialized ? current : next));
  }, [
    profile.applicationNumber,
    profile.admissionNumber,
    profile.enrollmentNumber,
    profile.fullName,
    profile.email,
    profile.mobileNumber,
    profile.dateOfBirth,
    profile.gender,
    profile.maritalStatus,
    profile.nationalId,
    profile.bloodGroupLookupId,
    profile.studentStatus,
    profile.rfidNumber,
    profile.departmentId,
    dirty,
    saveMut.isPending,
  ]);
  useEffect(() => {
    const openEditor = () => setEditing(true);
    window.addEventListener('student-profile-edit', openEditor);
    return () => window.removeEventListener('student-profile-edit', openEditor);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);
  const locked = !canEdit || !editing;
  const [photoMessage, setPhotoMessage] = useState('');
  const photoMut = useMutation({
    mutationFn: (file: File) => uploadStudentPhoto(profile.id, file),
    onSuccess: (result) => {
      setPhotoMessage('Photo updated');
      setTimeout(() => setPhotoMessage(''), 2500);
      void qc.invalidateQueries({ queryKey: ['students', profile.id, 'profile'] });
      if (result?.photoPath) {
        qc.setQueryData(['students', profile.id, 'profile'], (prev: StudentProfile | undefined) =>
          prev ? { ...prev, photoPath: result.photoPath } : prev,
        );
      }
    },
  });

  const saveMessage = saveMut.isError
    ? apiErrorMessage(saveMut.error, 'Save failed')
    : saveMut.isSuccess && !dirty
      ? 'Saved'
      : '';
  const footerMessage = photoMut.isError
    ? apiErrorMessage(photoMut.error, 'Photo upload failed')
    : photoMut.isPending
      ? 'Uploading photo…'
      : photoMessage || (saveMut.isPending ? 'Saving…' : saveMessage);
  const footerIsError = photoMut.isError || saveMut.isError;

  return (
    <SectionCard
      id="student-basic-information"
      title="Basic Information"
      description="Identity, contact and personal details"
      action={
        canEdit ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
            onClick={() => setEditing((open) => !open)}
          >
            {editing ? 'Close' : 'Edit'}
          </button>
        ) : null
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={footerIsError ? 'text-destructive' : undefined}>{footerMessage}</span>
          {editing ? (
            <span className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium"
                onClick={() => {
                  setForm(baseline);
                  setEditing(false);
                  saveMut.reset();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                disabled={!dirty || saveMut.isPending || Boolean(aadhaarError)}
                onClick={() => saveMut.mutate()}
              >
                {saveMut.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </span>
          ) : null}
        </div>
      }
    >
      <div className="mb-4">
        <StudentPhotoUpload
          photoPath={profile.photoPath}
          size="lg"
          buttonLabel="Update Photo"
          disabled={!canEdit || photoMut.isPending}
          onSelect={(file: File) => {
            photoMut.mutate(file);
          }}
        />
      </div>
      <FieldGrid columns="pair">
        {(
          [
            ['Application Number', 'applicationNumber'],
            ['Admission Number', 'admissionNumber'],
            ['Enrollment / Admission No.', 'enrollmentNumber'],
            ['Full Name', 'fullName'],
            ['Personal Email', 'email'],
            ['Mobile Number', 'mobileNumber'],
            ['Date of Birth', 'dateOfBirth'],
            ['RFID Number', 'rfidNumber'],
          ] as const
        ).map(([label, key]) => (
          <Field key={key} label={label} required={key === 'fullName' || key === 'dateOfBirth'}>
            {key === 'dateOfBirth' ? (
              <DateInput
                className={inputClass}
                disabled={locked}
                value={form.dateOfBirth}
                onChange={(dateOfBirth) => setForm((f) => ({ ...f, dateOfBirth }))}
              />
            ) : (
              <input
                className={inputClass}
                disabled={locked || key === 'enrollmentNumber'}
                type={key === 'email' ? 'email' : 'text'}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            )}
            {key === 'enrollmentNumber' ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                This follows the current college roll after a shift transfer. The previous roll
                stays in the transfer history.
              </p>
            ) : null}
          </Field>
        ))}
        <Field label="Marital Status">
          <select
            className={inputClass}
            disabled={locked}
            value={form.maritalStatus}
            onChange={(e) => setForm((f) => ({ ...f, maritalStatus: e.target.value }))}
          >
            <option value="">Select marital status</option>
            {MARITAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {form.maritalStatus &&
            !MARITAL_OPTIONS.some((option) => option.value === form.maritalStatus) ? (
              <option value={form.maritalStatus}>{form.maritalStatus}</option>
            ) : null}
          </select>
        </Field>
        <Field label="Gender" required>
          <select
            className={inputClass}
            disabled={locked}
            value={normalizeGenderCode(form.gender) || form.gender || ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                gender: normalizeGenderCode(e.target.value) || e.target.value,
              }))
            }
          >
            <option value="">Select gender</option>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Aadhaar Number">
          <input
            className={inputClass}
            disabled={locked}
            inputMode="numeric"
            maxLength={12}
            placeholder="12-digit Aadhaar"
            value={form.nationalId}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                nationalId: e.target.value.replace(/\D/g, '').slice(0, 12),
              }))
            }
          />
          {aadhaarError ? (
            <p className="mt-1 text-[11px] text-destructive">{aadhaarError}</p>
          ) : null}
        </Field>
        <Field label="Blood Group">
          <select
            className={inputClass}
            disabled={locked || bloodGroups.isLoading}
            value={form.bloodGroupLookupId}
            onChange={(e) => setForm((f) => ({ ...f, bloodGroupLookupId: e.target.value }))}
          >
            <option value="">Select blood group</option>
            {(bloodGroups.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
            {form.bloodGroupLookupId &&
            !(bloodGroups.data ?? []).some((row) => row.id === form.bloodGroupLookupId) ? (
              <option value={form.bloodGroupLookupId}>
                {profile.bloodGroup || 'Saved blood group'}
              </option>
            ) : null}
          </select>
        </Field>
        <Field label="Student Status">
          <select
            className={inputClass}
            disabled={locked}
            value={form.studentStatus}
            onChange={(e) => setForm((f) => ({ ...f, studentStatus: e.target.value }))}
          >
            {STUDENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Programme">
          <input className={inputClass} disabled value={profile.programme ?? ''} />
        </Field>
        <Field label="Batch">
          <input className={inputClass} disabled value={profile.batch ?? ''} />
        </Field>
        <Field label="Current Semester" required>
          <input className={inputClass} disabled value={String(profile.semester)} />
        </Field>
        <Field label="Shift">
          <input className={inputClass} disabled value={profile.shift ?? ''} />
        </Field>
        <Field label="Department">
          <SearchableDepartmentSelect
            value={form.departmentId}
            options={departmentOptions}
            disabled={locked || departments.isLoading}
            placeholder="Select academic department"
            onChange={(departmentId) => setForm((f) => ({ ...f, departmentId }))}
          />
        </Field>
      </FieldGrid>
    </SectionCard>
  );
}

export function AcademicIdentitySection({
  profile,
  canEdit,
}: {
  profile: StudentProfile;
  canEdit: boolean;
}) {
  const rollHistoryQ = useQuery({
    queryKey: ['students', profile.id, 'roll-shift-history'],
    queryFn: () => fetchStudentRollShiftHistory(profile.id),
  });
  const nehuRegistration =
    profile.universityRegistrationNumber ??
    (profile.enrollmentNumber && profile.enrollmentNumber !== profile.rollNumber
      ? profile.enrollmentNumber
      : '');
  const nehuRoll = profile.universityRollNumber ?? profile.admissionNumber ?? '';

  const [form, setForm] = useState({
    abcId: profile.abcId ?? '',
    universityRegistrationNumber: nehuRegistration,
    universityRollNumber: nehuRoll,
    rollNumber: profile.rollNumber ?? '',
  });
  const savePayload = useMemo(
    () => ({
      abcId: form.abcId,
      universityRegistrationNumber: form.universityRegistrationNumber.trim() || undefined,
      universityRollNumber: form.universityRollNumber.trim() || undefined,
      rollNumber: form.rollNumber || undefined,
    }),
    [form],
  );
  const { message, saving } = useDebouncedSave(profile.id, 'basic', savePayload, canEdit);

  return (
    <SectionCard
      title="Academic Identity"
      description="NEP / UGC identifiers and ERP student reference"
      footer={saving ? 'Saving…' : message}
    >
      <FieldGrid columns="pair">
        <Field label="ABC ID">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form.abcId}
            maxLength={20}
            placeholder="Enter ABC ID"
            onChange={(e) => setForm((f) => ({ ...f, abcId: e.target.value.trim().slice(0, 20) }))}
          />
        </Field>
        <Field label="NEHU Registration No.">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form.universityRegistrationNumber}
            onChange={(e) =>
              setForm((f) => ({ ...f, universityRegistrationNumber: e.target.value }))
            }
          />
        </Field>
        <Field label="NEHU Roll No.">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form.universityRollNumber}
            onChange={(e) => setForm((f) => ({ ...f, universityRollNumber: e.target.value }))}
          />
        </Field>
        <Field label="College Roll No.">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form.rollNumber}
            onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))}
          />
          {rollHistoryQ.data?.previousRollNumber ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Previous roll:{' '}
              <span className="font-mono">{rollHistoryQ.data.previousRollNumber}</span>
            </p>
          ) : null}
        </Field>
        <Field label="Student ERP ID">
          <input
            className={cn(inputClass, 'bg-muted/40 font-mono text-xs')}
            disabled
            value={profile.id}
          />
        </Field>
      </FieldGrid>
    </SectionCard>
  );
}

export function CategorySection({
  profile,
  canEdit,
}: {
  profile: StudentProfile;
  canEdit: boolean;
}) {
  const [form, setForm] = useState({
    categoryLookupId: profile.categoryLookupId ?? '',
    religionLookupId: profile.religionLookupId ?? '',
    tribeLookupId: profile.tribeLookupId ?? '',
    denominationLookupId: profile.denominationLookupId ?? '',
    differentlyAbled: profile.differentlyAbled ?? false,
    ews: profile.ews ?? false,
  });
  const { message, saving } = useDebouncedSave(profile.id, 'category_reservation', form, canEdit);

  const categoryLookups = useQuery({
    queryKey: ['master-lookups', 'CATEGORY'],
    queryFn: () => fetchMasterLookups('CATEGORY'),
  });
  const religionLookups = useQuery({
    queryKey: ['master-lookups', 'RELIGION'],
    queryFn: () => fetchMasterLookups('RELIGION'),
  });
  const tribeLookups = useQuery({
    queryKey: ['master-lookups', 'TRIBE'],
    queryFn: () => fetchMasterLookups('TRIBE'),
  });
  const denominationLookups = useQuery({
    queryKey: ['master-lookups', 'DENOMINATION'],
    queryFn: () => fetchMasterLookups('DENOMINATION'),
  });

  return (
    <SectionCard title="Category & Reservation" footer={saving ? 'Saving…' : message}>
      <FieldGrid>
        <Field label="Category">
          <select
            className={inputClass}
            disabled={!canEdit || categoryLookups.isLoading}
            value={form.categoryLookupId}
            onChange={(e) => setForm((f) => ({ ...f, categoryLookupId: e.target.value }))}
          >
            <option value="">Select category</option>
            {(categoryLookups.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Religion">
          <select
            className={inputClass}
            disabled={!canEdit || religionLookups.isLoading}
            value={form.religionLookupId}
            onChange={(e) => setForm((f) => ({ ...f, religionLookupId: e.target.value }))}
          >
            <option value="">Select religion</option>
            {(religionLookups.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tribe">
          <select
            className={inputClass}
            disabled={!canEdit || tribeLookups.isLoading}
            value={form.tribeLookupId}
            onChange={(e) => setForm((f) => ({ ...f, tribeLookupId: e.target.value }))}
          >
            <option value="">Select tribe</option>
            {(tribeLookups.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Denomination">
          <select
            className={inputClass}
            disabled={!canEdit || denominationLookups.isLoading}
            value={form.denominationLookupId}
            onChange={(e) => setForm((f) => ({ ...f, denominationLookupId: e.target.value }))}
          >
            <option value="">Select denomination</option>
            {(denominationLookups.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </Field>
      </FieldGrid>
      <div className="flex flex-wrap gap-6 pt-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={form.differentlyAbled}
            onChange={(e) => setForm((f) => ({ ...f, differentlyAbled: e.target.checked }))}
          />
          Differently abled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={form.ews}
            onChange={(e) => setForm((f) => ({ ...f, ews: e.target.checked }))}
          />
          Economically Weaker Section (EWS)
        </label>
      </div>
    </SectionCard>
  );
}

export function AddressSection({
  profile,
  canEdit,
}: {
  profile: StudentProfile;
  canEdit: boolean;
}) {
  const withContent = (types: string[]) =>
    types
      .map((type) => profile.addresses?.find((a) => a.addressType === type))
      .find((row) => row && (row.line1 || row.city || row.district || row.pinCode));
  const tura =
    withContent(['CURRENT', 'TURA']) ?? profile.addresses?.find((a) => a.addressType === 'TURA');
  const home =
    withContent(['PERMANENT', 'HOME']) ?? profile.addresses?.find((a) => a.addressType === 'HOME');
  const [form, setForm] = useState({
    homeSameAsTura: false,
    tura: {
      line1: tura?.line1 ?? '',
      line2: tura?.line2 ?? '',
      city: tura?.city ?? '',
      state: tura?.state ?? '',
      district: tura?.district ?? '',
      pinCode: tura?.pinCode ?? '',
    },
    home: {
      line1: home?.line1 ?? '',
      line2: home?.line2 ?? '',
      city: home?.city ?? '',
      state: home?.state ?? '',
      district: home?.district ?? '',
      pinCode: home?.pinCode ?? '',
    },
  });
  const { message, saving } = useDebouncedSave(profile.id, 'address', form, canEdit);

  const addrFields = (prefix: 'tura' | 'home', title: string, disabled?: boolean) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <FieldGrid>
        {(['line1', 'line2', 'city', 'district', 'state', 'pinCode'] as const).map((k) => (
          <Field
            key={k}
            label={k === 'line1' ? 'Address line 1' : k === 'pinCode' ? 'PIN Code' : k}
          >
            <input
              className={inputClass}
              disabled={!canEdit || disabled}
              value={form[prefix][k]}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  [prefix]: { ...f[prefix], [k]: e.target.value },
                }))
              }
            />
          </Field>
        ))}
      </FieldGrid>
    </div>
  );

  return (
    <SectionCard title="Address Information" footer={saving ? 'Saving…' : message}>
      {addrFields('tura', 'Address in Tura')}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={!canEdit}
          checked={form.homeSameAsTura}
          onChange={(e) => setForm((f) => ({ ...f, homeSameAsTura: e.target.checked }))}
        />
        Same as Tura address
      </label>
      {addrFields('home', 'Home Address', form.homeSameAsTura)}
    </SectionCard>
  );
}

export function GuardiansSection({
  profile,
  canEdit,
}: {
  profile: StudentProfile;
  canEdit: boolean;
}) {
  const g = (type: string) => profile.guardians?.find((x) => x.guardianType === type);
  const [form, setForm] = useState({
    father: {
      fullName: g('FATHER')?.fullName ?? '',
      age: g('FATHER')?.age ?? undefined,
      occupation: g('FATHER')?.occupation ?? '',
      contactNumber: g('FATHER')?.contactNumber ?? '',
    },
    mother: {
      fullName: g('MOTHER')?.fullName ?? '',
      age: g('MOTHER')?.age ?? undefined,
      occupation: g('MOTHER')?.occupation ?? '',
      contactNumber: g('MOTHER')?.contactNumber ?? '',
    },
    localGuardian: {
      fullName: (g('LOCAL_GUARDIAN') ?? g('GUARDIAN'))?.fullName ?? '',
      age: (g('LOCAL_GUARDIAN') ?? g('GUARDIAN'))?.age ?? undefined,
      occupation: (g('LOCAL_GUARDIAN') ?? g('GUARDIAN'))?.occupation ?? '',
      contactNumber: (g('LOCAL_GUARDIAN') ?? g('GUARDIAN'))?.contactNumber ?? '',
    },
  });
  const { message, saving } = useDebouncedSave(profile.id, 'guardians', form, canEdit);

  const block = (key: 'father' | 'mother' | 'localGuardian', title: string) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <FieldGrid>
        <Field label="Name">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form[key].fullName ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, [key]: { ...f[key], fullName: e.target.value } }))
            }
          />
        </Field>
        <Field label="Age">
          <input
            className={inputClass}
            disabled={!canEdit}
            type="number"
            value={form[key].age ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                [key]: { ...f[key], age: e.target.value ? Number(e.target.value) : undefined },
              }))
            }
          />
        </Field>
        <Field label="Occupation">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form[key].occupation ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, [key]: { ...f[key], occupation: e.target.value } }))
            }
          />
        </Field>
        <Field label="Contact">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form[key].contactNumber ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, [key]: { ...f[key], contactNumber: e.target.value } }))
            }
          />
        </Field>
      </FieldGrid>
    </div>
  );

  return (
    <SectionCard title="Parent / Guardian Information" footer={saving ? 'Saving…' : message}>
      {block('father', 'Father')}
      {block('mother', 'Mother')}
      {block('localGuardian', 'Local Guardian')}
    </SectionCard>
  );
}

function ProfileToneCard({
  tone,
  icon: Icon,
  title,
  description,
  footer,
  children,
}: {
  tone: 'blue' | 'violet';
  icon: typeof GraduationCap;
  title: string;
  description: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div
        className={cn(
          'flex items-start gap-3 px-5 py-4 text-white',
          tone === 'blue'
            ? 'bg-gradient-to-r from-blue-600 to-indigo-500'
            : 'bg-gradient-to-r from-violet-600 to-purple-500',
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-white/85">{description}</p>
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
      {footer ? (
        <div className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">{footer}</div>
      ) : null}
    </section>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof GraduationCap;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-blue-600" />
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

export function AcademicSection({
  profile,
  canEdit = false,
}: {
  profile: StudentProfile;
  canEdit?: boolean;
}) {
  const majorChoice = profile.programChoices?.find((c) => c.choiceType === 'MAJOR');
  const minorChoice = profile.programChoices?.find((c) => c.choiceType === 'MINOR');
  const major = majorChoice?.subjectName ?? majorChoice?.subjectSlug;
  const minor = minorChoice?.subjectName ?? minorChoice?.subjectSlug;

  const [residenceForm, setResidenceForm] = useState({
    residenceType: profile.residenceType ?? '',
    hostelBlock: profile.hostelBlock ?? '',
    hostelRoom: profile.hostelRoom ?? '',
  });
  const [advancedForm, setAdvancedForm] = useState({
    aggregatePercentageThroughSem6:
      profile.aggregatePercentageThroughSem6 != null
        ? String(profile.aggregatePercentageThroughSem6)
        : '',
    previousCollegeName: profile.previousCollegeName ?? '',
    admissionType: profile.admissionType ?? '',
  });

  useEffect(() => {
    setResidenceForm({
      residenceType: profile.residenceType ?? '',
      hostelBlock: profile.hostelBlock ?? '',
      hostelRoom: profile.hostelRoom ?? '',
    });
  }, [profile.residenceType, profile.hostelBlock, profile.hostelRoom]);

  useEffect(() => {
    setAdvancedForm({
      aggregatePercentageThroughSem6:
        profile.aggregatePercentageThroughSem6 != null
          ? String(profile.aggregatePercentageThroughSem6)
          : '',
      previousCollegeName: profile.previousCollegeName ?? '',
      admissionType: profile.admissionType ?? '',
    });
  }, [profile.aggregatePercentageThroughSem6, profile.previousCollegeName, profile.admissionType]);

  const residencePayload = useMemo(
    () => ({
      residenceType: residenceForm.residenceType || undefined,
      hostelBlock: residenceForm.hostelBlock || undefined,
      hostelRoom: residenceForm.hostelRoom || undefined,
    }),
    [residenceForm],
  );
  const { message: residenceMessage, saving: residenceSaving } = useDebouncedSave(
    profile.id,
    'academic',
    residencePayload,
    canEdit,
  );

  const advancedPayload = useMemo(() => {
    const pctRaw = advancedForm.aggregatePercentageThroughSem6.trim();
    const pct = pctRaw === '' ? undefined : Number(pctRaw);
    return {
      aggregatePercentageThroughSem6: pct != null && Number.isFinite(pct) ? pct : undefined,
      previousCollegeName: advancedForm.previousCollegeName.trim() || undefined,
      admissionType: advancedForm.admissionType || undefined,
    };
  }, [advancedForm]);
  const showAdvanced = profile.semester >= 7;
  const { message: advancedMessage, saving: advancedSaving } = useDebouncedSave(
    profile.id,
    'academic',
    advancedPayload,
    canEdit && showAdvanced,
  );

  const isHosteller = residenceForm.residenceType === 'HOSTELLER';

  return (
    <ProfileToneCard
      tone="blue"
      icon={GraduationCap}
      title="Academic Information"
      description="Programme details, subject choices, and current semester registration."
      footer={residenceSaving || advancedSaving ? 'Saving…' : residenceMessage || advancedMessage}
    >
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <SummaryTile icon={GraduationCap} label="Programme" value={profile.programme || '—'} />
        <SummaryTile icon={CalendarDays} label="Batch" value={profile.batch || '—'} />
        <SummaryTile icon={Layers} label="Semester" value={`Sem ${profile.semester || 1}`} />
        <SummaryTile icon={SunMedium} label="Shift" value={profile.shift || '—'} />
      </div>
      <FieldGrid>
        <Field label="Major Subject">
          <input className={inputClass} disabled value={major ?? '—'} />
        </Field>
        <Field label="Minor Subject">
          <input className={inputClass} disabled value={minor ?? '—'} />
        </Field>
        <Field label="Stream">
          <input className={inputClass} disabled value={profile.stream ?? '—'} />
        </Field>
        <Field label="Session / Academic Year">
          <input className={inputClass} disabled value={profile.entrySession ?? '—'} />
        </Field>
      </FieldGrid>
      <div className="flex gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          To correct a wrong Major, Minor, MDC, AEC, SEC, or VAC, open Change Subjects / Shift.
          Admins can save those changes after registration is completed.
        </p>
      </div>
      {showAdvanced ? (
        <div className="mt-3 rounded-md border border-border p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Sem 7+ / NEHU attestation
          </p>
          <FieldGrid>
            <Field label="Admission type">
              <select
                className={inputClass}
                disabled={!canEdit}
                value={advancedForm.admissionType}
                onChange={(e) => setAdvancedForm((f) => ({ ...f, admissionType: e.target.value }))}
              >
                <option value="">Not set</option>
                {['REGULAR', 'LATERAL', 'MIGRATION', 'RE_ADMISSION'].map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Attested aggregate % through Sem 6">
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                className={inputClass}
                disabled={!canEdit}
                value={advancedForm.aggregatePercentageThroughSem6}
                onChange={(e) =>
                  setAdvancedForm((f) => ({
                    ...f,
                    aggregatePercentageThroughSem6: e.target.value,
                  }))
                }
                placeholder="From NEHU documents"
              />
            </Field>
            <Field label="Previous college">
              <input
                className={inputClass}
                disabled={!canEdit}
                value={advancedForm.previousCollegeName}
                onChange={(e) =>
                  setAdvancedForm((f) => ({
                    ...f,
                    previousCollegeName: e.target.value,
                  }))
                }
                placeholder="NEHU-affiliated college (lateral)"
              />
            </Field>
          </FieldGrid>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Research pathway at Sem 8 needs ≥ 75%. Lateral / migration also need MIGRATION or TC
            documents before Sem 7+ registration can be submitted.
          </p>
        </div>
      ) : null}
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Home className="h-4 w-4 text-blue-600" /> Residence / Hostel
        </p>
        <FieldGrid>
          <Field label="Residence type">
            <select
              className={inputClass}
              disabled={!canEdit}
              value={residenceForm.residenceType}
              onChange={(e) =>
                setResidenceForm((f) => ({
                  ...f,
                  residenceType: e.target.value,
                  ...(e.target.value !== 'HOSTELLER' ? { hostelBlock: '', hostelRoom: '' } : {}),
                }))
              }
            >
              <option value="">Not set</option>
              <option value="DAY_SCHOLAR">Day scholar</option>
              <option value="HOSTELLER">Hosteller</option>
            </select>
          </Field>
          <Field label="Hostel block">
            <input
              className={inputClass}
              disabled={!canEdit || !isHosteller}
              value={residenceForm.hostelBlock}
              onChange={(e) => setResidenceForm((f) => ({ ...f, hostelBlock: e.target.value }))}
              placeholder={isHosteller ? 'Block / wing' : '—'}
            />
          </Field>
          <Field label="Room Number">
            <input
              className={inputClass}
              disabled={!canEdit || !isHosteller}
              value={residenceForm.hostelRoom}
              onChange={(e) => setResidenceForm((f) => ({ ...f, hostelRoom: e.target.value }))}
              placeholder={isHosteller ? 'Room no.' : '—'}
            />
          </Field>
        </FieldGrid>
      </div>
      <CurrentSemesterRegistrationCard profile={profile} major={major} />
      <Link
        href={`/admin/students/${profile.id}/academic`}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
      >
        Edit academic profile
      </Link>
      <SubjectChangeEditor profile={profile} />
    </ProfileToneCard>
  );
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
    ACC: 'Commerce',
    BOT: 'Botany',
    CHE: 'Chemistry',
    MAT: 'Mathematics',
    PHY: 'Physics',
    ZOO: 'Zoology',
  };
  return prefix ? map[prefix] : undefined;
}

function CurrentSemesterRegistrationCard({
  profile,
  major,
}: {
  profile: StudentProfile;
  major?: string;
}) {
  const currentSemester = Number(profile.semester ?? 1);
  const enrollments = (profile.sectionEnrollments ?? []).filter(
    (row) => Number(row.semesterSequence) === currentSemester,
  );

  const majorPapers = enrollments.filter(
    (row) => String(row.category ?? '').toUpperCase() === 'MAJOR',
  );
  const majorDepartment = major ?? departmentFromCourseCode(majorPapers[0]?.courseCode) ?? '—';

  const categoryOrder = ['MAJOR', 'MDC', 'AEC', 'SEC', 'VAC', 'MINOR', 'VTC', 'INTERNSHIP'];
  const rows = [...enrollments].sort((left, right) => {
    const leftIndex = categoryOrder.indexOf(String(left.category ?? '').toUpperCase());
    const rightIndex = categoryOrder.indexOf(String(right.category ?? '').toUpperCase());
    return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
  });
  const totalCredits = rows.reduce((sum, row) => sum + (row.credits ?? 0), 0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">Current Semester Registration</p>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          Semester {currentSemester}
        </span>
      </div>
      <div className="grid gap-2 border-b border-slate-100 px-4 py-3 sm:grid-cols-3">
        <div className="rounded-xl bg-emerald-50 px-3 py-2">
          <p className="text-[11px] text-emerald-700">Major Department</p>
          <p className="font-semibold text-slate-800">{majorDepartment}</p>
        </div>
        <div className="rounded-xl bg-violet-50 px-3 py-2">
          <p className="text-[11px] text-violet-700">Registered Subjects</p>
          <p className="font-semibold text-slate-800">{rows.length}</p>
        </div>
        <div className="rounded-xl bg-sky-50 px-3 py-2">
          <p className="text-[11px] text-sky-700">Total Credits</p>
          <p className="font-semibold text-slate-800">{totalCredits}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">
          No subjects registered for this semester.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Subject Code</th>
                <th className="px-4 py-2 font-medium">Subject Title</th>
                <th className="px-4 py-2 font-medium">NEP Category</th>
                <th className="px-4 py-2 font-medium">Credits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const category = String(row.category ?? '').toUpperCase() || '—';
                return (
                  <tr
                    key={`${row.courseCode}-${row.registrationId}`}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-2 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          categoryPill(category),
                        )}
                      >
                        {row.courseCode}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-800">
                      {formatCourseDisplayTitle(row.courseTitle)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          categoryPill(category),
                        )}
                      >
                        {categoryLabel(category)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700">{row.credits ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function categoryPill(category: string) {
  const map: Record<string, string> = {
    MAJOR: 'bg-sky-100 text-sky-700',
    MINOR: 'bg-cyan-100 text-cyan-700',
    MDC: 'bg-amber-100 text-amber-700',
    AEC: 'bg-emerald-100 text-emerald-700',
    SEC: 'bg-rose-100 text-rose-700',
    VAC: 'bg-violet-100 text-violet-700',
    VTC: 'bg-teal-100 text-teal-700',
  };
  return map[category] ?? 'bg-slate-100 text-slate-700';
}

function categoryLabel(category: string) {
  if (category === 'MAJOR') return 'Major';
  if (category === 'MINOR') return 'Minor';
  return category;
}

export function FyugpRegistrationSection({ profile }: { profile: StudentProfile }) {
  return <StudentSubjectsTab profile={profile} />;
}

export function BoardExamSection({
  profile,
  canEdit,
}: {
  profile: StudentProfile;
  canEdit: boolean;
}) {
  const exam = profile.boardExam;
  const class12Optional = isExcelImportedStudent(profile);
  const [form, setForm] = useState({
    boardName: exam?.boardName ?? '',
    boardNameOther: exam?.boardNameOther ?? '',
    schoolName: exam?.schoolName ?? '',
    boardRollNumber: exam?.boardRollNumber ?? '',
    examYear: exam?.examYear ?? undefined,
    stream: normalizeClass12Stream(exam?.stream ?? ''),
    registrationType: exam?.registrationType ?? '',
    division: exam?.division ?? '',
    subjectMarks:
      exam?.subjectMarks?.map((m) => ({
        subjectName: m.subjectName,
        marksObtained: m.marksObtained ?? undefined,
        maxMarks: m.maxMarks ?? undefined,
        grade: (m as { grade?: string }).grade ?? '',
      })) ?? (class12Optional ? [] : emptyBoardExamSubjectRows()),
  });
  const { message, saving } = useDebouncedSave(
    profile.id,
    'board_exam',
    sanitizeBoardExamPayload(form),
    canEdit,
  );
  const boardNamesQ = useQuery({
    queryKey: ['support-data', 'board-names', 'board-exam'],
    queryFn: () => fetchBoardNames({ activeOnly: true }),
  });

  const boardOptions = (boardNamesQ.data ?? []).map((board) => ({
    value: board.label,
    label: `${board.label} (${board.code})`,
  }));

  return (
    <ProfileToneCard
      tone="violet"
      icon={Award}
      title="Board Examination (Class XII)"
      description="Higher Secondary (Class XII) examination details and subject marks."
      footer={saving ? 'Saving…' : message}
    >
      <FieldGrid>
        <Field label="School / Institution">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form.schoolName}
            onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))}
          />
        </Field>
        <Field label="Board Roll Number">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form.boardRollNumber}
            onChange={(e) => setForm((f) => ({ ...f, boardRollNumber: e.target.value }))}
          />
        </Field>
        <Field label="Year">
          <input
            className={inputClass}
            disabled={!canEdit}
            type="number"
            value={form.examYear ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                examYear: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
        </Field>
      </FieldGrid>
      <div className="mt-4">
        <ClassXiiSubjectMarksEditor
          appearance="table"
          boardName={form.boardName}
          boardNameOther={form.boardNameOther}
          stream={form.stream}
          subjectMarks={form.subjectMarks}
          boardOptions={
            form.boardName && !boardOptions.some((b) => b.value === form.boardName)
              ? [...boardOptions, { value: form.boardName, label: form.boardName }]
              : boardOptions
          }
          showBoardSelect
          disabled={!canEdit}
          minSubjects={class12Optional ? 0 : 5}
          requireCatalog={!class12Optional}
          inputClassName={inputClass}
          onBoardChange={(boardName) => setForm((f) => ({ ...f, boardName }))}
          onBoardNameOtherChange={(boardNameOther) => setForm((f) => ({ ...f, boardNameOther }))}
          onStreamChange={(stream) => setForm((f) => ({ ...f, stream }))}
          onSubjectMarksChange={(subjectMarks) =>
            setForm((f) => ({
              ...f,
              subjectMarks: subjectMarks.map((mark) => ({
                subjectName: mark.subjectName,
                marksObtained: mark.marksObtained ?? undefined,
                maxMarks: mark.maxMarks ?? undefined,
                grade: mark.grade ?? undefined,
              })),
            }))
          }
        />
      </div>
    </ProfileToneCard>
  );
}

export function CuetSection({ profile, canEdit }: { profile: StudentProfile; canEdit: boolean }) {
  const c = profile.cuetDetail;
  const [form, setForm] = useState({
    cuetApplied: c?.cuetApplied ?? false,
    cuetRollNumber: c?.cuetRollNumber ?? '',
    cuetScore: c?.cuetScore ? Number(c.cuetScore) : undefined,
    cuetSubjects: c?.cuetSubjects ?? [],
  });
  const { message, saving } = useDebouncedSave(profile.id, 'cuet', form, canEdit);

  return (
    <SectionCard title="CUET Information" footer={saving ? 'Saving…' : message}>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={!canEdit}
          checked={form.cuetApplied}
          onChange={(e) => setForm((f) => ({ ...f, cuetApplied: e.target.checked }))}
        />
        CUET Applied
      </label>
      <FieldGrid>
        <Field label="CUET Roll Number">
          <input
            className={inputClass}
            disabled={!canEdit || !form.cuetApplied}
            value={form.cuetRollNumber}
            onChange={(e) => setForm((f) => ({ ...f, cuetRollNumber: e.target.value }))}
          />
        </Field>
        <Field label="CUET Score">
          <input
            className={inputClass}
            disabled={!canEdit || !form.cuetApplied}
            type="number"
            value={form.cuetScore ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                cuetScore: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
        </Field>
      </FieldGrid>
    </SectionCard>
  );
}

export function DocumentsSection({
  profile,
  canEdit,
  onRefresh,
}: {
  profile: StudentProfile;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const verifyMut = useMutation({
    mutationFn: ({
      docId,
      status,
      remarks,
    }: {
      docId: string;
      status: 'VERIFIED' | 'REJECTED';
      remarks?: string;
    }) =>
      verifyStudentDocument(profile.id, docId, {
        verificationStatus: status,
        verificationRemarks: remarks,
      }),
    onSuccess: () => {
      onRefresh();
      void qc.invalidateQueries({ queryKey: ['students', profile.id, 'profile'] });
    },
  });

  const openDocument = (filePath?: string | null) => {
    const url = resolveUploadAssetUrl(filePath);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const rejectDocument = (docId: string) => {
    const remarks = window.prompt(
      'Optional rejection reason (shown to the student / office notes):',
      '',
    );
    if (remarks === null) return;
    verifyMut.mutate({
      docId,
      status: 'REJECTED',
      remarks: remarks.trim() || 'Rejected — please re-upload a clear matching document',
    });
  };

  const photoUrl = resolveUploadAssetUrl(profile.photoPath);

  return (
    <SectionCard title="Documents & Verification">
      {photoUrl ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <div>
            <p className="font-medium">Passport photo (profile)</p>
            <p className="text-xs text-muted-foreground">
              Use View to check the face photo before verifying document uploads.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => openDocument(profile.photoPath)}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            View photo
          </Button>
        </div>
      ) : null}
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          {DOC_TYPES.map((type) => (
            <label key={type} className="cursor-pointer">
              <input
                type="file"
                className="hidden"
                accept=".pdf,image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await uploadStudentDocument(profile.id, type, file);
                  onRefresh();
                  e.target.value = '';
                }}
              />
              <span className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted">
                Upload {type}
              </span>
            </label>
          ))}
        </div>
      ) : null}
      <ul className="divide-y divide-border rounded-md border border-border">
        {(profile.documents ?? []).length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">No documents uploaded</li>
        ) : (
          profile.documents!.map((doc) => {
            const viewUrl = resolveUploadAssetUrl(doc.filePath);
            return (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {doc.documentType} — {doc.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status: {doc.verificationStatus ?? 'PENDING'}
                    {doc.verificationRemarks ? ` · ${doc.verificationRemarks}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {viewUrl ? (
                    <Button size="sm" variant="outline" onClick={() => openDocument(doc.filePath)}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      View
                    </Button>
                  ) : null}
                  {canEdit ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={verifyMut.isPending}
                        onClick={() => verifyMut.mutate({ docId: doc.id, status: 'VERIFIED' })}
                      >
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        disabled={verifyMut.isPending}
                        onClick={() => rejectDocument(doc.id)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteStudentDocument(profile.id, doc.id).then(onRefresh)}
                      >
                        Delete
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </SectionCard>
  );
}

export function SystemSection({ profile }: { profile: StudentProfile }) {
  const sys = profile.system;
  return (
    <SectionCard title="System Information" description="Read-only audit fields">
      <FieldGrid>
        <Field label="Created At">
          <input
            className={inputClass}
            disabled
            value={formatDisplayDateTime(sys?.createdAt ?? profile.admissionDate)}
          />
        </Field>
        <Field label="Updated At">
          <input className={inputClass} disabled value={formatDisplayDateTime(sys?.updatedAt)} />
        </Field>
        <Field label="Created By">
          <input className={inputClass} disabled value={sys?.createdBy?.email ?? '—'} />
        </Field>
        <Field label="Last Modified By">
          <input className={inputClass} disabled value={sys?.lastModifiedBy?.email ?? '—'} />
        </Field>
        <Field label="Import Source">
          <input className={inputClass} disabled value={profile.importSource ?? '—'} />
        </Field>
        <Field label="Admission Source">
          <input className={inputClass} disabled value={profile.admissionSource ?? '—'} />
        </Field>
        <Field label="Login Enabled">
          <input className={inputClass} disabled value={sys?.loginEnabled ? 'Yes' : 'No'} />
        </Field>
      </FieldGrid>
    </SectionCard>
  );
}

export function ProfileSectionContent({
  section,
  profile,
  canEdit,
  onRefresh,
}: {
  section: ProfileSectionKey;
  profile: StudentProfile;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  switch (section) {
    case 'basic':
      return <BasicSection profile={profile} canEdit={canEdit} />;
    case 'category_reservation':
      return <CategorySection profile={profile} canEdit={canEdit} />;
    case 'address':
      return <AddressSection profile={profile} canEdit={canEdit} />;
    case 'guardians':
      return <GuardiansSection profile={profile} canEdit={canEdit} />;
    case 'academic':
      return <AcademicSection profile={profile} />;
    case 'fyugp_registration':
      return <FyugpRegistrationSection profile={profile} />;
    case 'board_exam':
      return <BoardExamSection profile={profile} canEdit={canEdit} />;
    case 'cuet':
      return <CuetSection profile={profile} canEdit={canEdit} />;
    case 'documents':
      return <DocumentsSection profile={profile} canEdit={canEdit} onRefresh={onRefresh} />;
    case 'system':
      return <SystemSection profile={profile} />;
    default:
      return null;
  }
}
