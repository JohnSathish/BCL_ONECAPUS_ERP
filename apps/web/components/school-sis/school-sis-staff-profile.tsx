'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  BookOpen,
  Bus,
  FileText,
  GraduationCap,
  Home,
  KeyRound,
  Phone,
  Save,
  Share2,
  UserRound,
  Users,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import {
  asStaffExtras,
  compactStaffExtras,
  isoDateInput,
  staffInitials,
  staffProfileCompletion,
  type StaffExtras,
} from '@/lib/school-sis/staff-profile';
import { schoolPeopleNav } from '@/lib/school-sis/people-routes';
import {
  createSchoolSisStaff,
  fetchSchoolSisMasters,
  fetchSchoolSisNextStaffCode,
  fetchSchoolSisStaffOne,
  patchSchoolSisStaff,
  removeSchoolSisStaffPhoto,
  uploadSchoolSisStaffDocument,
  uploadSchoolSisStaffPhoto,
  type SchoolSisStaff,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type FormState = {
  employeeCode: string;
  fullName: string;
  staffType: string;
  designation: string;
  classAssigned: string;
  gender: string;
  phone: string;
  email: string;
  bloodGroup: string;
  joiningDate: string;
  fatherSpouseName: string;
  dateOfBirth: string;
  academicQualification: string;
  professionalQualification: string;
  teachingExperience: string;
  trainingStatus: string;
  address: string;
  status: string;
  remarks: string;
  extras: StaffExtras;
};

const DESIGNATIONS = [
  'Teacher',
  'Senior Teacher',
  'PGT',
  'TGT',
  'PRT',
  'Lecturer',
  'Head of Department',
  'Vice Principal',
  'Principal',
  'Librarian',
];

const FALLBACK_CLASSES = [
  'Nursery',
  'KG',
  'Class I',
  'Class II',
  'Class III',
  'Class IV',
  'Class V',
  'Class VI',
  'Class VII',
  'Class VIII',
  'Class IX',
  'Class X',
  'Class XI',
  'Class XII',
];

const FALLBACK_SUBJECTS = [
  'English',
  'Alternative English',
  'Khasi',
  'Garo',
  'Hindi',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Accountancy',
  'Business Studies',
  'Economics',
  'Political Science',
  'History',
  'Geography',
  'Education',
  'Physical Education',
];

function splitList(raw: string) {
  return raw
    .split(/[,;|/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinList(items: string[]) {
  return items
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

const EMPTY: FormState = {
  employeeCode: '',
  fullName: '',
  staffType: 'TEACHING',
  designation: 'Teacher',
  classAssigned: '',
  gender: '',
  phone: '',
  email: '',
  bloodGroup: '',
  joiningDate: '',
  fatherSpouseName: '',
  dateOfBirth: '',
  academicQualification: '',
  professionalQualification: '',
  teachingExperience: '',
  trainingStatus: '',
  address: '',
  status: 'ACTIVE',
  remarks: '',
  extras: {},
};

function hydrate(row: SchoolSisStaff): FormState {
  return {
    employeeCode: row.employeeCode ?? '',
    fullName: row.fullName ?? '',
    staffType: row.staffType || 'TEACHING',
    designation: row.designation ?? '',
    classAssigned: row.classAssigned ?? '',
    gender: row.gender ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    bloodGroup: row.bloodGroup ?? '',
    joiningDate: isoDateInput(row.joiningDate),
    fatherSpouseName: row.fatherSpouseName ?? '',
    dateOfBirth: isoDateInput(row.dateOfBirth),
    academicQualification: row.academicQualification ?? '',
    professionalQualification: row.professionalQualification ?? '',
    teachingExperience: row.teachingExperience ?? '',
    trainingStatus: row.trainingStatus ?? '',
    address: row.address ?? '',
    status: row.status || 'ACTIVE',
    remarks: row.remarks ?? '',
    extras: asStaffExtras(row.extrasJson),
  };
}

function Field({
  label,
  children,
  className,
  required,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-300',
        props.className,
      )}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-300',
        props.className,
      )}
    />
  );
}

function ChipMultiSelect({
  values,
  options,
  onChange,
  disabled,
  placeholder,
}: {
  values: string[];
  options: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const remaining = options.filter((option) => !values.includes(option));
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus-within:border-sky-300">
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex items-center gap-1 rounded-md bg-[#e8f1fb] px-2 py-0.5 text-xs font-semibold text-[#1a365d]"
        >
          {value}
          {!disabled ? (
            <button
              type="button"
              className="text-slate-400 hover:text-slate-700"
              onClick={() => onChange(values.filter((item) => item !== value))}
              aria-label={`Remove ${value}`}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
      {!disabled && remaining.length ? (
        <select
          className="h-7 min-w-[7.5rem] flex-1 border-0 bg-transparent text-sm text-slate-600 outline-none"
          value=""
          onChange={(e) => {
            const next = e.target.value;
            if (next) onChange([...values, next]);
          }}
        >
          <option value="">{placeholder ?? 'Select'}</option>
          {remaining.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sls-staff-card">
      <div className="sls-staff-card-head">
        <Icon className="h-4 w-4 text-sky-700" />
        <h2>{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function SchoolSisStaffProfile({ staffId }: { staffId: string }) {
  const isNew = staffId === 'new';
  const enabled = useAuthQueryEnabled();
  const router = useRouter();
  const { teachers, base, title } = schoolPeopleNav(usePathname());
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.session?.user);
  const canManage = canManageSchoolSis(user?.permissions);
  const photoRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const letterRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    teachers ? EMPTY : { ...EMPTY, staffType: 'NON_TEACHING', designation: '' },
  );
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const query = useQuery({
    queryKey: ['school-sis-staff', staffId],
    queryFn: () => fetchSchoolSisStaffOne(staffId),
    enabled: enabled && !isNew && Boolean(staffId),
  });
  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled,
  });

  useEffect(() => {
    if (query.data) setForm(hydrate(query.data));
  }, [query.data]);

  const nextCode = useQuery({
    queryKey: ['school-sis-staff-next-code', form.staffType],
    queryFn: () => fetchSchoolSisNextStaffCode(form.staffType),
    enabled: enabled && isNew,
  });
  const assignedCode = isNew ? (nextCode.data?.employeeCode ?? '') : form.employeeCode;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setExtra = <K extends keyof StaffExtras>(key: K, value: StaffExtras[K]) =>
    setForm((f) => ({ ...f, extras: { ...f.extras, [key]: value } }));

  const completion = useMemo(
    () => (query.data ? staffProfileCompletion(query.data) : null),
    [query.data],
  );

  const save = useMutation({
    mutationFn: async () => {
      const extrasJson = compactStaffExtras(form.extras);
      if (isNew) {
        const created = await createSchoolSisStaff({
          fullName: form.fullName,
          staffType: form.staffType,
          designation: form.designation,
        });
        await patchSchoolSisStaff(created.id, {
          ...payloadFromForm(form),
          extrasJson,
        });
        return created;
      }
      return patchSchoolSisStaff(staffId, { ...payloadFromForm(form), extrasJson });
    },
    onSuccess: (row) => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-sis-staff'] });
      if (isNew && row?.id) router.replace(`${base}/${row.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const photoMut = useMutation({
    mutationFn: (file: File) => uploadSchoolSisStaffPhoto(staffId, file),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-sis-staff', staffId] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const removePhoto = useMutation({
    mutationFn: () => removeSchoolSisStaffPhoto(staffId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['school-sis-staff', staffId] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const docMut = useMutation({
    mutationFn: ({ slot, file }: { slot: 'RESUME' | 'JOINING_LETTER'; file: File }) =>
      uploadSchoolSisStaffDocument(staffId, slot, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['school-sis-staff', staffId] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const photoUrl = resolveUploadAssetUrl(query.data?.photoUrl);
  const docs = form.extras.documents ?? {};
  const readOnly = !canManage;
  const classOptions = useMemo(() => {
    const fromSchool = (masters.data?.grades ?? [])
      .filter((g) => g.active !== false)
      .map((g) => g.name)
      .filter(Boolean);
    return Array.from(
      new Set([
        ...(fromSchool.length ? fromSchool : FALLBACK_CLASSES),
        ...splitList(form.classAssigned),
      ]),
    );
  }, [masters.data?.grades, form.classAssigned]);
  const subjectOptions = useMemo(() => {
    const fromSchool = (masters.data?.subjects ?? [])
      .filter((s) => s.active !== false)
      .map((s) => s.name)
      .filter(Boolean);
    const selected = form.extras.subjectsTaught ?? [];
    return Array.from(
      new Set([...(fromSchool.length ? fromSchool : FALLBACK_SUBJECTS), ...selected]),
    );
  }, [masters.data?.subjects, form.extras.subjectsTaught]);
  const designationOptions = useMemo(
    () => Array.from(new Set([...DESIGNATIONS, form.designation].filter(Boolean))),
    [form.designation],
  );

  if (!isNew && query.isLoading) {
    return <p className="text-sm text-slate-500">Loading staff profile…</p>;
  }
  if (!isNew && query.isError) {
    return <p className="text-sm text-red-600">{apiErrorMessage(query.error)}</p>;
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canManage) return;
        save.mutate();
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-400">
            <Link href={base} className="hover:text-[#1a365d]">
              {title}
            </Link>
            <span className="px-1.5">/</span>
            <span>My Profile</span>
            <span className="px-1.5">/</span>
            <span className="text-[#2563eb]">Edit Profile</span>
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#1a365d]">
            {isNew ? (teachers ? 'Add teacher' : 'Add staff') : 'Edit Profile'}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Keep your information up to date. This information may be visible to authorized staff
            and administrators.
            {completion ? ` Profile ${completion.percent}% complete.` : ''}
          </p>
        </div>
        {!isNew ? (
          <Link
            href={base}
            className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-[#1a365d]"
          >
            View Profile
          </Link>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Section icon={UserRound} title="Personal Information">
        <div className="grid gap-4 lg:grid-cols-[11rem_1fr]">
          <div>
            {photoUrl ? (
              <img src={photoUrl} alt="" className="h-28 w-28 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-lg font-semibold text-slate-400">
                {staffInitials(form.fullName)}
              </div>
            )}
            {canManage && !isNew ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-[#2563eb] px-2.5 py-1 text-xs font-semibold text-white"
                  onClick={() => photoRef.current?.click()}
                >
                  Upload Photo
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
                  onClick={() => removePhoto.mutate()}
                  disabled={!query.data?.photoUrl}
                >
                  Remove
                </button>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) photoMut.mutate(file);
                  }}
                />
              </div>
            ) : null}
            <p className="mt-1 text-[11px] text-slate-400">JPG, PNG, SVG (Max 4MB)</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label={form.staffType === 'NON_TEACHING' ? 'Staff ID' : 'Teacher ID'}>
              <TextInput
                value={assignedCode || (isNew ? 'Generating…' : '')}
                readOnly
                disabled
                className="bg-slate-50 font-mono tracking-wide"
              />
              <span className="mt-1 block text-[11px] text-slate-400">
                Assigned automatically
                {form.staffType === 'NON_TEACHING'
                  ? ' as SLS-NTC-001, 002…'
                  : ' as SLS-TCH-001, 002…'}
              </span>
            </Field>
            <Field label="Full Name" required>
              <TextInput
                value={form.fullName}
                onChange={(e) => set('fullName', e.target.value)}
                required
                disabled={readOnly}
              />
            </Field>
            <Field label="Designation" required>
              <SelectInput
                value={form.designation}
                onChange={(e) => set('designation', e.target.value)}
                disabled={readOnly}
              >
                <option value="">Select</option>
                {designationOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Gender" required>
              <SelectInput
                value={form.gender}
                onChange={(e) => set('gender', e.target.value)}
                disabled={readOnly}
              >
                <option value="">Select</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </SelectInput>
            </Field>
            <Field label="Date of Birth" required>
              <TextInput
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => set('dateOfBirth', e.target.value)}
                disabled={readOnly}
              />
            </Field>
            <Field label="Blood Group">
              <SelectInput
                value={form.bloodGroup}
                onChange={(e) => set('bloodGroup', e.target.value)}
                disabled={readOnly}
              >
                <option value="">Select</option>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Date of Joining" required>
              <TextInput
                type="date"
                value={form.joiningDate}
                onChange={(e) => set('joiningDate', e.target.value)}
                disabled={readOnly}
              />
            </Field>
            <Field label="Status" required>
              <SelectInput
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                disabled={readOnly}
                className={form.status === 'ACTIVE' ? 'font-semibold text-emerald-700' : undefined}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </SelectInput>
            </Field>
          </div>
        </div>
      </Section>

      <Section icon={GraduationCap} title="Academic & Professional Information">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Class Assigned" required className="xl:col-span-2">
            <ChipMultiSelect
              values={splitList(form.classAssigned)}
              options={classOptions}
              onChange={(next) => set('classAssigned', joinList(next))}
              disabled={readOnly}
              placeholder="Select class"
            />
          </Field>
          <Field label="Subjects Taught" required className="xl:col-span-2">
            <ChipMultiSelect
              values={form.extras.subjectsTaught ?? []}
              options={subjectOptions}
              onChange={(next) => setExtra('subjectsTaught', next)}
              disabled={readOnly}
              placeholder="Select subject"
            />
          </Field>
          <Field label="Type" required>
            <SelectInput
              value={form.staffType}
              onChange={(e) => set('staffType', e.target.value)}
              disabled={readOnly}
            >
              <option value="TEACHING">Teaching</option>
              <option value="NON_TEACHING">Non-teaching</option>
            </SelectInput>
          </Field>
          <Field label="Training Status">
            <SelectInput
              value={form.trainingStatus}
              onChange={(e) => set('trainingStatus', e.target.value)}
              disabled={readOnly}
            >
              <option value="">Select</option>
              <option value="Trained">Trained</option>
              <option value="Untrained">Untrained</option>
            </SelectInput>
          </Field>
          <Field label="Academic Qualification" required className="xl:col-span-2">
            <TextInput
              value={form.academicQualification}
              onChange={(e) => set('academicQualification', e.target.value)}
              disabled={readOnly}
            />
          </Field>
          <Field label="Professional Qualification">
            <TextInput
              value={form.professionalQualification}
              onChange={(e) => set('professionalQualification', e.target.value)}
              disabled={readOnly}
              placeholder="Enter professional qualification"
            />
          </Field>
          <Field label="Teaching Experience" required>
            <div className="flex items-center gap-2">
              <TextInput
                value={form.teachingExperience.replace(/\s*years?\.?$/i, '').trim()}
                onChange={(e) => set('teachingExperience', e.target.value)}
                disabled={readOnly}
                inputMode="decimal"
              />
              <span className="shrink-0 text-sm text-slate-500">years</span>
            </div>
          </Field>
        </div>
      </Section>

      <Section icon={Phone} title="Contact Information">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Primary Contact Number" required>
            <div className="flex">
              <span className="inline-flex h-10 items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-500">
                +91
              </span>
              <TextInput
                className="rounded-l-none"
                value={form.phone.replace(/^\+91\s*/, '')}
                onChange={(e) => set('phone', e.target.value)}
                disabled={readOnly}
              />
            </div>
          </Field>
          <Field label="Email Address" required>
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              disabled={readOnly}
            />
          </Field>
          <Field label="Address">
            <TextInput
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              disabled={readOnly}
            />
          </Field>
        </div>
      </Section>

      <Section icon={FileText} title="Additional Information">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Father / Spouse Name">
            <TextInput
              value={form.fatherSpouseName}
              onChange={(e) => set('fatherSpouseName', e.target.value)}
              disabled={readOnly}
            />
          </Field>
          <Field label="Emergency Contact Number">
            <div className="flex">
              <span className="inline-flex h-10 items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-500">
                +91
              </span>
              <TextInput
                className="rounded-l-none"
                value={(form.extras.emergencyPhone ?? '').replace(/^\+91\s*/, '')}
                onChange={(e) => setExtra('emergencyPhone', e.target.value)}
                disabled={readOnly}
              />
            </div>
          </Field>
          <Field label="Emergency Contact Name">
            <TextInput
              value={form.extras.emergencyName ?? ''}
              onChange={(e) => setExtra('emergencyName', e.target.value)}
              disabled={readOnly}
            />
          </Field>
          <Field label="Notes">
            <TextInput
              value={form.remarks}
              onChange={(e) => set('remarks', e.target.value)}
              disabled={readOnly}
              placeholder="Any additional notes…"
            />
          </Field>
        </div>
      </Section>

      {canManage ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={base}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-600"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563eb] px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {save.isPending
              ? 'Saving…'
              : isNew
                ? teachers
                  ? 'Save teacher'
                  : 'Save staff'
                : 'Save Changes'}
          </button>
        </div>
      ) : null}

      <Section icon={Banknote} title="Payroll">
        <p className="mb-3 text-xs text-slate-400">
          Leave blank until payroll records are available. Do not enter placeholder figures.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="EPF No">
            <TextInput
              value={form.extras.payroll?.epfNo ?? ''}
              onChange={(e) =>
                setExtra('payroll', { ...form.extras.payroll, epfNo: e.target.value })
              }
              disabled={readOnly}
            />
          </Field>
          <Field label="Basic Salary">
            <TextInput
              value={form.extras.payroll?.basicSalary ?? ''}
              onChange={(e) =>
                setExtra('payroll', { ...form.extras.payroll, basicSalary: e.target.value })
              }
              disabled={readOnly}
            />
          </Field>
          <Field label="Contract Type">
            <TextInput
              value={form.extras.payroll?.contractType ?? ''}
              onChange={(e) =>
                setExtra('payroll', { ...form.extras.payroll, contractType: e.target.value })
              }
              disabled={readOnly}
            />
          </Field>
          <Field label="Work Shift">
            <TextInput
              value={form.extras.payroll?.workShift ?? ''}
              onChange={(e) =>
                setExtra('payroll', { ...form.extras.payroll, workShift: e.target.value })
              }
              disabled={readOnly}
            />
          </Field>
          <Field label="Work Location">
            <TextInput
              value={form.extras.payroll?.workLocation ?? ''}
              onChange={(e) =>
                setExtra('payroll', { ...form.extras.payroll, workLocation: e.target.value })
              }
              disabled={readOnly}
            />
          </Field>
          <Field label="Date of Leaving">
            <TextInput
              type="date"
              value={form.extras.payroll?.dateOfLeaving ?? ''}
              onChange={(e) =>
                setExtra('payroll', { ...form.extras.payroll, dateOfLeaving: e.target.value })
              }
              disabled={readOnly}
            />
          </Field>
        </div>
      </Section>

      <Section icon={Users} title="Leaves">
        <p className="mb-3 text-xs text-slate-400">
          Balances are not imported. Enter only when the school records them.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(['medical', 'casual', 'maternity', 'sick'] as const).map((key) => (
            <Field key={key} label={`${key[0].toUpperCase()}${key.slice(1)} Leaves`}>
              <TextInput
                value={form.extras.leaves?.[key] ?? ''}
                onChange={(e) =>
                  setExtra('leaves', { ...form.extras.leaves, [key]: e.target.value })
                }
                disabled={readOnly}
              />
            </Field>
          ))}
        </div>
      </Section>

      <Section icon={BookOpen} title="Bank Account Detail">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Account Name">
            <TextInput
              value={form.extras.bank?.accountName ?? ''}
              onChange={(e) =>
                setExtra('bank', { ...form.extras.bank, accountName: e.target.value })
              }
              disabled={readOnly}
            />
          </Field>
          <Field label="Account Number">
            <TextInput
              value={form.extras.bank?.accountNumber ?? ''}
              onChange={(e) =>
                setExtra('bank', { ...form.extras.bank, accountNumber: e.target.value })
              }
              disabled={readOnly}
            />
          </Field>
          <Field label="Bank Name">
            <TextInput
              value={form.extras.bank?.bankName ?? ''}
              onChange={(e) => setExtra('bank', { ...form.extras.bank, bankName: e.target.value })}
              disabled={readOnly}
            />
          </Field>
          <Field label="IFSC Code">
            <TextInput
              value={form.extras.bank?.ifsc ?? ''}
              onChange={(e) => setExtra('bank', { ...form.extras.bank, ifsc: e.target.value })}
              disabled={readOnly}
            />
          </Field>
          <Field label="Branch Name">
            <TextInput
              value={form.extras.bank?.branchName ?? ''}
              onChange={(e) =>
                setExtra('bank', { ...form.extras.bank, branchName: e.target.value })
              }
              disabled={readOnly}
            />
          </Field>
        </div>
      </Section>

      <Section icon={Bus} title="Transport Information">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Route">
            <TextInput
              value={form.extras.transport?.route ?? ''}
              onChange={(e) =>
                setExtra('transport', { ...form.extras.transport, route: e.target.value })
              }
              disabled={readOnly}
            />
          </Field>
          <Field label="Vehicle Number">
            <TextInput
              value={form.extras.transport?.vehicleNumber ?? ''}
              onChange={(e) =>
                setExtra('transport', { ...form.extras.transport, vehicleNumber: e.target.value })
              }
              disabled={readOnly}
            />
          </Field>
          <Field label="Pickup Point">
            <TextInput
              value={form.extras.transport?.pickupPoint ?? ''}
              onChange={(e) =>
                setExtra('transport', { ...form.extras.transport, pickupPoint: e.target.value })
              }
              disabled={readOnly}
            />
          </Field>
        </div>
      </Section>

      <Section icon={Home} title="Hostel Information">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Hostel">
            <TextInput
              value={form.extras.hostel?.hostel ?? ''}
              onChange={(e) =>
                setExtra('hostel', { ...form.extras.hostel, hostel: e.target.value })
              }
              disabled={readOnly}
            />
          </Field>
          <Field label="Room No">
            <TextInput
              value={form.extras.hostel?.roomNo ?? ''}
              onChange={(e) =>
                setExtra('hostel', { ...form.extras.hostel, roomNo: e.target.value })
              }
              disabled={readOnly}
            />
          </Field>
        </div>
      </Section>

      <Section icon={Share2} title="Social Media Links">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {(
            [
              ['facebook', 'Facebook'],
              ['instagram', 'Instagram'],
              ['linkedin', 'LinkedIn'],
              ['youtube', 'Youtube'],
              ['twitter', 'Twitter URL'],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <TextInput
                value={form.extras.social?.[key] ?? ''}
                onChange={(e) =>
                  setExtra('social', { ...form.extras.social, [key]: e.target.value })
                }
                disabled={readOnly}
              />
            </Field>
          ))}
        </div>
      </Section>

      <Section icon={FileText} title="Documents">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[12px] font-semibold text-slate-500">Upload Resume</p>
            <p className="text-[11px] text-slate-400">Upload size of 4MB, Accepted Format PDF</p>
            {canManage && !isNew ? (
              <button
                type="button"
                className="mt-2 rounded-md bg-[#2563eb] px-3 py-1.5 text-xs font-medium text-white"
                onClick={() => resumeRef.current?.click()}
              >
                {docs.resume?.fileName ? 'Change' : 'Upload Document'}
              </button>
            ) : null}
            <p className="mt-1 text-sm text-slate-700">{docs.resume?.fileName || 'Not uploaded'}</p>
            <input
              ref={resumeRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) docMut.mutate({ slot: 'RESUME', file });
              }}
            />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-slate-500">Upload Joining Letter</p>
            <p className="text-[11px] text-slate-400">Upload size of 4MB, Accepted Format PDF</p>
            {canManage && !isNew ? (
              <button
                type="button"
                className="mt-2 rounded-md bg-[#2563eb] px-3 py-1.5 text-xs font-medium text-white"
                onClick={() => letterRef.current?.click()}
              >
                {docs.joiningLetter?.fileName ? 'Change' : 'Upload Document'}
              </button>
            ) : null}
            <p className="mt-1 text-sm text-slate-700">
              {docs.joiningLetter?.fileName || 'Not uploaded'}
            </p>
            <input
              ref={letterRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) docMut.mutate({ slot: 'JOINING_LETTER', file });
              }}
            />
          </div>
        </div>
      </Section>

      <Section icon={KeyRound} title="Password">
        <p className="mb-3 text-xs text-slate-400">
          Staff portal login is not enabled yet. Passwords are not stored on this form.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="New Password">
            <TextInput
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm Password">
            <TextInput
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled
              autoComplete="new-password"
            />
          </Field>
        </div>
        <button
          type="button"
          className="mt-2 text-xs text-slate-500"
          onClick={() => setShowPassword((v) => !v)}
        >
          Coming soon
        </button>
      </Section>
    </form>
  );
}

function payloadFromForm(form: FormState) {
  return {
    fullName: form.fullName,
    staffType: form.staffType,
    designation: form.designation,
    classAssigned: form.classAssigned,
    gender: form.gender,
    phone: form.phone,
    email: form.email,
    bloodGroup: form.bloodGroup,
    joiningDate: form.joiningDate || null,
    fatherSpouseName: form.fatherSpouseName,
    dateOfBirth: form.dateOfBirth || null,
    academicQualification: form.academicQualification,
    professionalQualification: form.professionalQualification,
    teachingExperience: form.teachingExperience,
    trainingStatus: form.trainingStatus,
    address: form.address,
    status: form.status,
    remarks: form.remarks,
  };
}
