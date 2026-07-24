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
import { fetchAcademicSubjects } from '@/services/academic-engine';
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
import { formatCourseDisplayTitle } from '@/utils/format-course-title';

const STUDENT_STATUSES = ['STUDYING', 'ALUMNI', 'LEAVING', 'DETAINED', 'DROPPED'] as const;

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
    gender: profile.gender ?? '',
    maritalStatus: profile.maritalStatus ?? '',
    studentStatus: profile.studentStatus ?? 'STUDYING',
    rfidNumber: profile.rfidNumber ?? '',
    departmentId: profile.departmentId ?? '',
  });
  const departments = useQuery({
    queryKey: ['org', 'departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
  });
  const departmentOptions = (departments.data ?? []).map((d) => ({
    id: d.id,
    label: d.name,
  }));
  const savePayload = useMemo(
    () => ({
      ...form,
      email: form.email.trim() || undefined,
      departmentId: form.departmentId || undefined,
    }),
    [form],
  );
  const { message, saving } = useDebouncedSave(profile.id, 'basic', savePayload, canEdit);
  const qc = useQueryClient();
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

  const footerMessage = photoMut.isError
    ? apiErrorMessage(photoMut.error, 'Photo upload failed')
    : photoMut.isPending
      ? 'Uploading photo…'
      : photoMessage || (saving ? 'Saving…' : message);
  const footerIsError =
    photoMut.isError || Boolean(message && message !== 'Saved' && !message.startsWith('Saving'));

  return (
    <SectionCard
      title="Basic Information"
      description="Identity, contact, and enrollment identifiers"
      footer={footerMessage}
      footerClassName={footerIsError ? 'text-destructive' : undefined}
    >
      <div className="mb-4">
        <StudentPhotoUpload
          photoPath={profile.photoPath}
          disabled={!canEdit || photoMut.isPending}
          onSelect={(file: File) => {
            photoMut.mutate(file);
          }}
        />
      </div>
      <FieldGrid>
        {(
          [
            ['Application Number', 'applicationNumber'],
            ['Admission Number', 'admissionNumber'],
            ['Enrollment / Admission No.', 'enrollmentNumber'],
            ['Full Name', 'fullName'],
            ['Personal email', 'email'],
            ['Mobile', 'mobileNumber'],
            ['Date of Birth', 'dateOfBirth'],
            ['Gender', 'gender'],
            ['Marital Status', 'maritalStatus'],
            ['RFID Number', 'rfidNumber'],
          ] as const
        ).map(([label, key]) => (
          <Field key={key} label={label}>
            {key === 'dateOfBirth' ? (
              <DateInput
                className={inputClass}
                disabled={!canEdit}
                value={form.dateOfBirth}
                onChange={(dateOfBirth) => setForm((f) => ({ ...f, dateOfBirth }))}
              />
            ) : (
              <input
                className={inputClass}
                disabled={!canEdit}
                type={key === 'email' ? 'email' : 'text'}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            )}
            {key === 'enrollmentNumber' ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Permanent admission ID — does not change on a shift transfer. The current shift roll
                is in “College Roll No.”
              </p>
            ) : null}
          </Field>
        ))}
        <Field label="Student Status">
          <select
            className={inputClass}
            disabled={!canEdit}
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
        <Field label="Current Semester">
          <input className={inputClass} disabled value={String(profile.semester)} />
        </Field>
        <Field label="Shift">
          <input className={inputClass} disabled value={profile.shift ?? ''} />
        </Field>
        <Field label="Department">
          <SearchableDepartmentSelect
            value={form.departmentId}
            options={departmentOptions}
            disabled={!canEdit || departments.isLoading}
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
      <FieldGrid>
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
  const tura = profile.addresses?.find((a) => a.addressType === 'TURA');
  const home = profile.addresses?.find((a) => a.addressType === 'HOME');
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
      fullName: g('LOCAL_GUARDIAN')?.fullName ?? '',
      age: g('LOCAL_GUARDIAN')?.age ?? undefined,
      occupation: g('LOCAL_GUARDIAN')?.occupation ?? '',
      contactNumber: g('LOCAL_GUARDIAN')?.contactNumber ?? '',
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
    <SectionCard
      title="Academic Information"
      description="Derived from programme choices and current semester registration"
      footer={residenceSaving || advancedSaving ? 'Saving…' : residenceMessage || advancedMessage}
    >
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
        <Field label="Session">
          <input className={inputClass} disabled value={profile.entrySession ?? '—'} />
        </Field>
      </FieldGrid>
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
      <div className="rounded-md border border-border p-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">Residence / Hostel</p>
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
          <Field label="Room">
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
    </SectionCard>
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
  const currentSemester = profile.semester ?? 1;
  const enrollments = (profile.sectionEnrollments ?? []).filter(
    (row) => row.semesterSequence === currentSemester,
  );

  const majorPapers = enrollments.filter(
    (row) => String(row.category ?? '').toUpperCase() === 'MAJOR',
  );
  const majorDepartment = major ?? departmentFromCourseCode(majorPapers[0]?.courseCode) ?? '—';

  const groups = ['MDC', 'AEC', 'SEC', 'VAC', 'VTC', 'MINOR', 'INTERNSHIP'] as const;
  const byCategory = (category: string) =>
    enrollments.filter((row) => String(row.category ?? '').toUpperCase() === category);

  return (
    <div className="rounded-lg border border-border bg-muted/10 p-4">
      <p className="text-sm font-medium">Current Semester Registration</p>
      <p className="text-xs text-muted-foreground">Semester {currentSemester}</p>

      <div className="mt-3 space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Major Department
          </p>
          <p className="text-sm font-medium">{majorDepartment}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Major Papers
          </p>
          <ul className="mt-1 space-y-1 text-sm">
            {majorPapers.length ? (
              majorPapers.map((paper) => (
                <li key={`${paper.courseCode}-${paper.registrationId}`}>
                  •{' '}
                  <span className="font-mono text-xs text-muted-foreground">
                    {paper.courseCode}
                  </span>
                  {' — '}
                  {formatCourseDisplayTitle(paper.courseTitle)}
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">—</li>
            )}
          </ul>
        </div>
        {groups.map((category) => {
          const rows = byCategory(category);
          if (!rows.length) return null;
          return (
            <div key={category}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {rows.map((paper) => (
                  <li key={`${category}-${paper.courseCode}-${paper.registrationId}`}>
                    • {formatCourseDisplayTitle(paper.courseTitle)}
                    <span className="ml-1 font-mono text-xs text-muted-foreground">
                      ({paper.courseCode})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FyugpRegistrationSection({ profile }: { profile: StudentProfile }) {
  return (
    <SectionCard title="Registered subjects" description="All semester subject registrations">
      <StudentSubjectsTab profile={profile} />
    </SectionCard>
  );
}

export function BoardExamSection({
  profile,
  canEdit,
}: {
  profile: StudentProfile;
  canEdit: boolean;
}) {
  const exam = profile.boardExam;
  const [form, setForm] = useState({
    boardName: exam?.boardName ?? '',
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
      })) ?? emptyBoardExamSubjectRows(),
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
    <SectionCard title="Board Examination (Class XII)" footer={saving ? 'Saving…' : message}>
      <FieldGrid>
        <Field label="School">
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
          boardName={form.boardName}
          stream={form.stream}
          subjectMarks={form.subjectMarks}
          boardOptions={
            form.boardName && !boardOptions.some((b) => b.value === form.boardName)
              ? [...boardOptions, { value: form.boardName, label: form.boardName }]
              : boardOptions
          }
          showBoardSelect
          disabled={!canEdit}
          inputClassName={inputClass}
          onBoardChange={(boardName) => setForm((f) => ({ ...f, boardName }))}
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
    </SectionCard>
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
    mutationFn: ({ docId, status }: { docId: string; status: 'VERIFIED' | 'REJECTED' }) =>
      verifyStudentDocument(profile.id, docId, { verificationStatus: status }),
    onSuccess: () => {
      onRefresh();
      void qc.invalidateQueries({ queryKey: ['students', profile.id, 'profile'] });
    },
  });

  return (
    <SectionCard title="Documents & Verification">
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
          profile.documents!.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {doc.documentType} — {doc.fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: {doc.verificationStatus ?? 'PENDING'}
                </p>
              </div>
              <div className="flex gap-2">
                {canEdit ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => verifyMut.mutate({ docId: doc.id, status: 'VERIFIED' })}
                    >
                      Verify
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
          ))
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
