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
import { SearchableDepartmentSelect } from '@/components/students-module/add-student/ui/searchable-department-select';
import {
  deleteStudentDocument,
  updateStudentProfileSection,
  uploadStudentDocument,
  uploadStudentPhoto,
  verifyStudentDocument,
} from '@/services/students';
import { fetchAcademicDepartments } from '@/services/organization';
import {
  fetchAcademicSubjects,
  fetchCatalog,
  fetchShifts,
  setStudentProgramChoice,
} from '@/services/academic-engine';
import {
  fetchStudentRegistrationContext,
  updateAdminRegistrationLines,
} from '@/services/admin-registration';
import { fetchAllPrograms } from '@/services/programs';
import { fetchBoardNames, fetchBoardSubjects } from '@/services/support-data';
import type { StudentProfile } from '@/types/students';
import type { CatalogSectionRow, CatalogWithEligibility } from '@/types/academic-engine';
import type { ProfileSectionKey } from '@/types/student-profile';
import { DateInput } from '@/components/ui/date-input';
import { formatDisplayDateTime } from '@/utils/format-date';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { emptyBoardExamSubjectRows, sanitizeBoardExamPayload } from '@/lib/board-exam-form';

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

  return (
    <SectionCard
      title="Basic Information"
      description="Identity, contact, and enrollment identifiers"
      footer={footerMessage}
      footerClassName={photoMut.isError ? 'text-destructive' : undefined}
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
            ['Registration Number', 'enrollmentNumber'],
            ['Full Name', 'fullName'],
            ['Email', 'email'],
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
                type="text"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            )}
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
  const [form, setForm] = useState({
    abcId: profile.abcId ?? '',
    enrollmentNumber: profile.enrollmentNumber,
    admissionNumber: profile.admissionNumber ?? '',
    rollNumber: profile.rollNumber ?? '',
  });
  const savePayload = useMemo(
    () => ({
      abcId: form.abcId,
      enrollmentNumber: form.enrollmentNumber,
      admissionNumber: form.admissionNumber || undefined,
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
            value={form.enrollmentNumber}
            onChange={(e) => setForm((f) => ({ ...f, enrollmentNumber: e.target.value }))}
          />
        </Field>
        <Field label="NEHU Roll No.">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form.admissionNumber}
            onChange={(e) => setForm((f) => ({ ...f, admissionNumber: e.target.value }))}
          />
        </Field>
        <Field label="College Roll No.">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form.rollNumber}
            onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))}
          />
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

  return (
    <SectionCard title="Category & Reservation" footer={saving ? 'Saving…' : message}>
      <FieldGrid>
        <Field label="Category Lookup ID">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form.categoryLookupId}
            onChange={(e) => setForm((f) => ({ ...f, categoryLookupId: e.target.value }))}
          />
        </Field>
        <Field label="Religion Lookup ID">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form.religionLookupId}
            onChange={(e) => setForm((f) => ({ ...f, religionLookupId: e.target.value }))}
          />
        </Field>
        <Field label="Tribe Lookup ID">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form.tribeLookupId}
            onChange={(e) => setForm((f) => ({ ...f, tribeLookupId: e.target.value }))}
          />
        </Field>
        <Field label="Denomination Lookup ID">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form.denominationLookupId}
            onChange={(e) => setForm((f) => ({ ...f, denominationLookupId: e.target.value }))}
          />
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
  const nep = profile.nepCategoryGroups;

  const [residenceForm, setResidenceForm] = useState({
    residenceType: profile.residenceType ?? '',
    hostelBlock: profile.hostelBlock ?? '',
    hostelRoom: profile.hostelRoom ?? '',
  });

  useEffect(() => {
    setResidenceForm({
      residenceType: profile.residenceType ?? '',
      hostelBlock: profile.hostelBlock ?? '',
      hostelRoom: profile.hostelRoom ?? '',
    });
  }, [profile.residenceType, profile.hostelBlock, profile.hostelRoom]);

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

  const isHosteller = residenceForm.residenceType === 'HOSTELLER';

  return (
    <SectionCard
      title="Academic Information"
      description="Derived from programme choices and current semester registration"
      footer={residenceSaving ? 'Saving residence…' : residenceMessage}
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
      <div className="grid gap-3 md:grid-cols-3">
        {(['mdc', 'aec', 'sec', 'vac', 'vtc'] as const).map((cat) => (
          <div key={cat} className="rounded-md border border-border p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">{cat}</p>
            <ul className="mt-1 space-y-1 text-sm">
              {(nep?.[cat] ?? []).length === 0 ? (
                <li className="text-muted-foreground">—</li>
              ) : (
                nep[cat].map((c) => (
                  <li key={c.code}>
                    {c.code} — {c.title}
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </div>
      <Link
        href={`/admin/students/${profile.id}/academic`}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
      >
        Edit academic profile
      </Link>
      <FirstSemesterSubjectCorrectionEditor profile={profile} />
    </SectionCard>
  );
}

function subjectChangeCategoriesForSemester(semesterSequence: number): readonly string[] {
  if (semesterSequence <= 2) {
    return ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC'];
  }
  if (semesterSequence === 3) {
    return ['MAJOR', 'MDC', 'AEC', 'SEC', 'VTC'];
  }
  if (semesterSequence === 4) {
    return ['MAJOR', 'VTC'];
  }
  if (semesterSequence === 5) {
    return ['MAJOR', 'MINOR'];
  }
  return ['MAJOR'];
}

function subjectChangeCategoryLabel(category: string) {
  if (category === 'VTC') return 'VTC (Vocational Training)';
  if (category === 'VAC') return 'VAC (Value Added Course)';
  return category;
}

function subjectChangePanelDescription(semesterSequence: number) {
  const categories = subjectChangeCategoriesForSemester(semesterSequence)
    .map(subjectChangeCategoryLabel)
    .join(', ');
  return `For Semester ${semesterSequence} corrections: ${categories}, and shift.`;
}

function normalizeSubjectCategory(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

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

function slugifySubjectLabel(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function subjectSlugFromSection(section?: CatalogSectionRow) {
  return (
    section?.courseOffering.course.subjectSlug ??
    slugifySubjectLabel(section?.courseOffering.course.department?.name)
  );
}

function sectionOptionLabel(section: CatalogSectionRow) {
  const course = section.courseOffering.course;
  return `${course.code} — ${course.title} (${section.shift.code}-${section.sectionCode})`;
}

function FirstSemesterSubjectCorrectionEditor({ profile }: { profile: StudentProfile }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [programVersionId, setProgramVersionId] = useState('');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState('');
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  const context = useQuery({
    queryKey: ['admin-registrations', 'context', profile.id, 'first-semester-correction'],
    queryFn: () => fetchStudentRegistrationContext(profile.id),
    enabled: open,
  });

  const semesterSequence = context.data?.semesterSequence ?? profile.semester ?? 1;
  const changeCategories = useMemo(
    () => subjectChangeCategoriesForSemester(semesterSequence),
    [semesterSequence],
  );
  const registration = context.data?.registration;
  const registrationEditable = registration?.status === 'draft';

  const programmes = useQuery({
    queryKey: ['programs-courses', 'programmes', 'first-semester-correction'],
    queryFn: () => fetchAllPrograms(),
    enabled: open,
  });

  const programmeOptions = useMemo(
    () =>
      (programmes.data?.data ?? []).flatMap((program) =>
        (program.versions ?? [])
          .filter((version) => version.status === 'PUBLISHED')
          .map((version) => ({
            value: version.id,
            label: `${program.code} — ${program.name} v${version.version}`,
            departmentId: program.departmentId ?? null,
          })),
      ),
    [programmes.data?.data],
  );

  const shifts = useQuery({
    queryKey: ['academic-engine', 'shifts', 'first-semester-correction'],
    queryFn: fetchShifts,
    enabled: open,
  });

  const catalog = useQuery({
    queryKey: [
      'academic-engine',
      'first-semester-correction-catalog',
      profile.id,
      programVersionId,
      semesterSequence,
      shiftId,
    ],
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

  useEffect(() => {
    if (!open) return;
    setProgramVersionId(context.data?.student.programVersionId ?? profile.programVersionId ?? '');
    setShiftId(context.data?.student.primaryShiftId ?? '');
  }, [
    context.data?.student.primaryShiftId,
    context.data?.student.programVersionId,
    open,
    profile.programVersionId,
  ]);

  useEffect(() => {
    const option = programmeOptions.find((item) => item.value === programVersionId);
    setDepartmentId(option?.departmentId ?? null);
  }, [programVersionId, programmeOptions]);

  const registrationLineSignature = useMemo(() => {
    if (!registration?.lines?.length) return '';
    return (
      registration.lines as {
        category?: string | null;
        offeringSectionId?: string | null;
      }[]
    )
      .map((line) => `${normalizeSubjectCategory(line.category)}:${line.offeringSectionId ?? ''}`)
      .sort()
      .join('|');
  }, [registration?.lines]);

  const registrationSelectionSeed = useMemo(() => {
    if (!registrationLineSignature || !registration?.lines?.length) return null;
    const next: Record<string, string> = {};
    for (const line of registration.lines as {
      category?: string | null;
      offeringSectionId?: string | null;
    }[]) {
      const category = normalizeSubjectCategory(line.category);
      if (changeCategories.includes(category) && line.offeringSectionId) {
        next[category] = line.offeringSectionId;
      }
    }
    return next;
  }, [changeCategories, registration?.lines, registrationLineSignature]);

  useEffect(() => {
    if (!open || !registrationSelectionSeed) return;
    setSelections((current) => {
      const entries = Object.entries(registrationSelectionSeed);
      const unchanged =
        entries.length === Object.keys(current).length &&
        entries.every(([key, value]) => current[key] === value);
      return unchanged ? current : registrationSelectionSeed;
    });
  }, [open, registrationSelectionSeed]);

  const sections = catalogSections(catalog.data);
  const sectionById = useMemo(
    () => new Map(sections.map((section) => [section.id, section])),
    [sections],
  );
  const sectionsByCategory = useMemo(() => {
    const grouped = new Map<string, CatalogSectionRow[]>();
    for (const section of sections) {
      const category = normalizeSubjectCategory(section.courseOffering.category);
      if (!changeCategories.includes(category)) continue;
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category)!.push(section);
    }
    return grouped;
  }, [changeCategories, sections]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!registration?.id) {
        throw new Error(`No Semester ${semesterSequence} registration found for this student`);
      }
      if (!registrationEditable) {
        throw new Error(
          'Only draft registrations can be edited. This registration is already submitted.',
        );
      }
      if (!programVersionId) throw new Error('Select programme first');
      const selectedLines = changeCategories.flatMap((category) => {
        const section = sectionById.get(selections[category] ?? '');
        return section
          ? [
              {
                category,
                offeringId: section.courseOffering.id,
                offeringSectionId: section.id,
              },
            ]
          : [];
      });
      const preservedLines = (
        (registration.lines ?? []) as {
          category?: string | null;
          offeringId?: string | null;
          offeringSectionId?: string | null;
        }[]
      )
        .filter(
          (line) =>
            !changeCategories.includes(normalizeSubjectCategory(line.category)) && line.offeringId,
        )
        .map((line) => ({
          category: normalizeSubjectCategory(line.category),
          offeringId: line.offeringId ?? undefined,
          offeringSectionId: line.offeringSectionId ?? undefined,
        }));

      if (shiftId && shiftId !== context.data?.student.primaryShiftId) {
        await updateStudentProfileSection(profile.id, 'basic', {
          primaryShiftId: shiftId,
          programVersionId,
          departmentId,
        });
      } else if (programVersionId && programVersionId !== context.data?.student.programVersionId) {
        await updateStudentProfileSection(profile.id, 'basic', {
          programVersionId,
          departmentId,
        });
      }
      await updateAdminRegistrationLines(registration.id, [...selectedLines, ...preservedLines]);

      const majorSlug = subjectSlugFromSection(sectionById.get(selections.MAJOR ?? ''));
      const minorSlug = subjectSlugFromSection(sectionById.get(selections.MINOR ?? ''));
      if (majorSlug) {
        await setStudentProgramChoice(profile.id, {
          choiceType: 'MAJOR',
          subjectSlug: majorSlug,
        });
      }
      if (minorSlug) {
        await setStudentProgramChoice(profile.id, {
          choiceType: 'MINOR',
          subjectSlug: minorSlug,
        });
      }
    },
    onSuccess: () => {
      setMessage(`Semester ${semesterSequence} subjects and shift updated. Refreshing profile...`);
      void qc.invalidateQueries({ queryKey: ['students', profile.id, 'profile'] });
      void qc.invalidateQueries({ queryKey: ['students', profile.id, 'semester-registrations'] });
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'profile', profile.id] });
      void qc.invalidateQueries({ queryKey: ['admin-registrations', 'context', profile.id] });
    },
    onError: (error) => {
      setMessage(apiErrorMessage(error, `Could not update Semester ${semesterSequence} subjects`));
    },
  });

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Change Semester {semesterSequence} Subjects / Shift</p>
          <p className="text-xs text-muted-foreground">
            {subjectChangePanelDescription(semesterSequence)}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Hide correction panel' : 'Change subjects / shift'}
        </Button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          {!registrationEditable ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Only draft registrations can be edited here. If this semester is already submitted or
              completed, revert it to draft from subject registration administration first.
            </p>
          ) : null}
          <FieldGrid>
            <Field label="Programme / Department">
              <select
                className={inputClass}
                value={programVersionId}
                disabled={programmes.isLoading || !registrationEditable}
                onChange={(event) => {
                  setProgramVersionId(event.target.value);
                  setSelections({});
                  setMessage(
                    'Programme changed. Select subjects again from the new programme curriculum.',
                  );
                }}
              >
                <option value="">Select programme first</option>
                {programmeOptions.map((program) => (
                  <option key={program.value} value={program.value}>
                    {program.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Shift">
              <select
                className={inputClass}
                value={shiftId}
                disabled={shifts.isLoading || !registrationEditable}
                onChange={(event) => {
                  setShiftId(event.target.value);
                  setSelections({});
                }}
              >
                <option value="">Current shift</option>
                {(shifts.data ?? []).map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.code} — {shift.name}
                  </option>
                ))}
              </select>
            </Field>
          </FieldGrid>
          <div className="grid gap-3 md:grid-cols-2">
            {changeCategories.map((category) => {
              const options = sectionsByCategory.get(category) ?? [];
              return (
                <Field key={category} label={subjectChangeCategoryLabel(category)}>
                  <select
                    className={inputClass}
                    value={selections[category] ?? ''}
                    disabled={!registrationEditable || !programVersionId || catalog.isLoading}
                    onChange={(event) =>
                      setSelections((current) => ({
                        ...current,
                        [category]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select {subjectChangeCategoryLabel(category)} paper</option>
                    {options.map((section) => (
                      <option key={section.id} value={section.id}>
                        {sectionOptionLabel(section)}
                      </option>
                    ))}
                  </select>
                </Field>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={saveMut.isPending || !registrationEditable || !registration?.id}
              onClick={() => saveMut.mutate()}
            >
              {saveMut.isPending ? 'Saving...' : 'Save subject / shift changes'}
            </Button>
            <Link
              href={`/admin/students/subject-registration?student=${profile.id}`}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              Open subject registration
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Change Programme first when a student changes Major department. Subject options below
            are loaded from the selected programme Semester {semesterSequence} curriculum, then
            saved into the draft registration.
          </p>
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        </div>
      ) : null}
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
    stream: exam?.stream ?? '',
    registrationType: exam?.registrationType ?? '',
    division: exam?.division ?? '',
    subjectMarks:
      exam?.subjectMarks?.map((m) => ({
        subjectName: m.subjectName,
        marksObtained: m.marksObtained ?? undefined,
        maxMarks: m.maxMarks ?? undefined,
      })) ?? emptyBoardExamSubjectRows(),
  });
  const { message, saving } = useDebouncedSave(
    profile.id,
    'board_exam',
    sanitizeBoardExamPayload(form),
    canEdit,
  );
  const subjectsQuery = useQuery({
    queryKey: ['support-data', 'board-subjects', 'board-exam'],
    queryFn: () => fetchBoardSubjects({ activeOnly: true }),
  });
  const boardNamesQ = useQuery({
    queryKey: ['support-data', 'board-names', 'board-exam'],
    queryFn: () => fetchBoardNames({ activeOnly: true }),
  });

  return (
    <SectionCard title="Board Examination (Class XII)" footer={saving ? 'Saving…' : message}>
      <FieldGrid>
        <Field label="Board Name">
          <select
            className={inputClass}
            disabled={!canEdit}
            value={form.boardName}
            onChange={(e) => setForm((f) => ({ ...f, boardName: e.target.value }))}
          >
            <option value="">Select board</option>
            {(boardNamesQ.data ?? []).map((board) => (
              <option key={board.id} value={board.label}>
                {board.label} ({board.code})
              </option>
            ))}
            {form.boardName &&
            !(boardNamesQ.data ?? []).some((board) => board.label === form.boardName) ? (
              <option value={form.boardName}>{form.boardName}</option>
            ) : null}
          </select>
        </Field>
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
        <Field label="Stream">
          <input
            className={inputClass}
            disabled={!canEdit}
            value={form.stream}
            onChange={(e) => setForm((f) => ({ ...f, stream: e.target.value }))}
          />
        </Field>
      </FieldGrid>
      <div className="space-y-2">
        <p className="text-sm font-medium">Subject marks (min 5)</p>
        {form.subjectMarks.map((m, idx) => (
          <div key={idx} className="grid grid-cols-3 gap-2">
            <select
              className={inputClass}
              disabled={!canEdit}
              value={m.subjectName}
              onChange={(e) => {
                const next = [...form.subjectMarks];
                next[idx] = { ...next[idx], subjectName: e.target.value };
                setForm((f) => ({ ...f, subjectMarks: next }));
              }}
            >
              <option value="">Select subject</option>
              {(subjectsQuery.data ?? []).map((subject) => (
                <option key={subject.id} value={`${subject.label} (${subject.code})`}>
                  {subject.label} ({subject.code})
                </option>
              ))}
              {m.subjectName &&
              !(subjectsQuery.data ?? []).some(
                (s) => `${s.label} (${s.code})` === m.subjectName || s.label === m.subjectName,
              ) ? (
                <option value={m.subjectName}>{m.subjectName}</option>
              ) : null}
            </select>
            <input
              className={inputClass}
              disabled={!canEdit}
              type="number"
              placeholder="Obtained"
              value={m.marksObtained ?? ''}
              onChange={(e) => {
                const next = [...form.subjectMarks];
                next[idx] = {
                  ...next[idx],
                  marksObtained: e.target.value ? Number(e.target.value) : undefined,
                };
                setForm((f) => ({ ...f, subjectMarks: next }));
              }}
            />
            <input
              className={inputClass}
              disabled={!canEdit}
              type="number"
              placeholder="Max"
              value={m.maxMarks ?? ''}
              onChange={(e) => {
                const next = [...form.subjectMarks];
                next[idx] = {
                  ...next[idx],
                  maxMarks: e.target.value ? Number(e.target.value) : undefined,
                };
                setForm((f) => ({ ...f, subjectMarks: next }));
              }}
            />
          </div>
        ))}
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
